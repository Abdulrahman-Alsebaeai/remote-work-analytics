import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ActivityCategory, Prisma } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { TaskActor } from '../tasks/tasks.service';
import { CreateAiAnalysisDto } from './dto';
import { ACTIVITY_CLASSIFIER, ActivityClassifier, INSIGHT_GENERATOR, InsightGenerator } from './ports';

type Payload = Record<string, unknown>;

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name); private processing = false;
  constructor(private readonly db: PrismaService, private readonly audit: AuditService, private readonly analytics: AnalyticsService, @Inject(ACTIVITY_CLASSIFIER) private readonly classifier: ActivityClassifier, @Inject(INSIGHT_GENERATOR) private readonly insights: InsightGenerator) {}
  async onModuleInit() { await this.db.aiAnalysisJob.updateMany({ where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - 15 * 60_000) } }, data: { status: 'PENDING', startedAt: null, errorMessage: null } }); setImmediate(() => void this.drain()); }

  async create(dto: CreateAiAnalysisDto, actor: TaskActor) {
    if (!actor.organizationId || actor.role === 'EMPLOYEE') throw new ForbiddenException();
    const from = new Date(`${dto.from.slice(0, 10)}T00:00:00.000Z`); const to = new Date(`${dto.to.slice(0, 10)}T00:00:00.000Z`);
    if (from > to || to.valueOf() - from.valueOf() > 30 * 86400000) throw new BadRequestException('AI analysis range must be between 1 and 31 days');
    const job = await this.db.aiAnalysisJob.create({ data: { organizationId: actor.organizationId, requestedById: actor.id, fromDate: from, toDate: to, modelKey: this.classifier.key, modelVersion: this.classifier.version } });
    await this.audit.record({ organizationId: actor.organizationId, actorId: actor.id, action: 'AI_ANALYSIS_REQUESTED', targetType: 'AiAnalysisJob', targetId: job.id, result: 'SUCCESS', metadata: { from: dto.from, to: dto.to, modelKey: this.classifier.key, modelVersion: this.classifier.version } });
    setImmediate(() => void this.drain()); return job;
  }
  list(actor: TaskActor) { if (!actor.organizationId || actor.role === 'EMPLOYEE') throw new ForbiddenException(); return this.db.aiAnalysisJob.findMany({ where: { organizationId: actor.organizationId }, include: { requestedBy: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async get(id: string, actor: TaskActor) { if (!actor.organizationId || actor.role === 'EMPLOYEE') throw new ForbiddenException(); const job = await this.db.aiAnalysisJob.findFirst({ where: { id, organizationId: actor.organizationId }, include: { requestedBy: { select: { displayName: true } } } }); if (!job) throw new NotFoundException(); return job; }

  async drain() {
    if (this.processing) return; this.processing = true;
    try { while (true) { const pending = await this.db.aiAnalysisJob.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } }); if (!pending) break; const claimed = await this.db.aiAnalysisJob.updateMany({ where: { id: pending.id, status: 'PENDING' }, data: { status: 'RUNNING', startedAt: new Date(), errorMessage: null } }); if (!claimed.count) continue; await this.process(pending.id); } } finally { this.processing = false; }
  }

  private async process(id: string) {
    const job = await this.db.aiAnalysisJob.findUniqueOrThrow({ where: { id }, include: { requestedBy: true } });
    try {
      const categorySeconds = new Map<ActivityCategory, number>(); const structuredCategories = new Map<string, { category: ActivityCategory; seconds: number }>(); let cursor: string | undefined; let classifiedEvents = 0;
      while (true) {
        const events = await this.db.agentEvent.findMany({ where: { organizationId: job.organizationId, type: 'ACTIVITY_SAMPLE', occurredAt: { gte: job.fromDate, lt: new Date(job.toDate.valueOf() + 86400000) } }, select: { id: true, employeeId: true, payload: true }, orderBy: { id: 'asc' }, take: 500, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (!events.length) break;
        const operations: Prisma.PrismaPromise<unknown>[] = [];
        for (const event of events) {
          const payload = this.payload(event.payload);
          const classification = this.classifier.classify({ application: this.string(payload.applicationName) ?? this.string(payload.activeApplication), windowTitle: this.string(payload.activeWindowTitle), websiteTitle: this.string(payload.domain) ?? this.string(payload.websiteTitle), idleSeconds: this.string(payload.activityState) === 'IDLE' ? 60 : this.number(payload.idleSeconds) });
          const activityId = this.string(payload.activityId);
          if (activityId) {
            structuredCategories.set(activityId, { category: classification.category, seconds: Math.min(7 * 86400, Math.max(1, this.number(payload.durationSeconds, 1))) });
            const productivityClass = ['WORK', 'COMMUNICATION'].includes(classification.category) ? 'PRODUCTIVE' : ['ENTERTAINMENT', 'IDLE'].includes(classification.category) ? 'UNPRODUCTIVE' : 'UNDEFINED';
            operations.push(this.db.activitySession.updateMany({ where: { id: activityId, organizationId: job.organizationId, employeeId: event.employeeId }, data: { classification: productivityClass } }));
          } else {
            const seconds = Math.min(300, Math.max(1, this.number(payload.sampleDurationSeconds, 10)));
            categorySeconds.set(classification.category, (categorySeconds.get(classification.category) ?? 0) + seconds);
          }
          operations.push(this.db.activityClassification.upsert({ where: { eventId: event.id }, update: { category: classification.category, confidence: classification.confidence, productive: classification.productive, explanation: classification.explanation as unknown as Prisma.InputJsonValue, modelKey: this.classifier.key, modelVersion: this.classifier.version, classifiedAt: new Date() }, create: { organizationId: job.organizationId, employeeId: event.employeeId, eventId: event.id, category: classification.category, confidence: classification.confidence, productive: classification.productive, explanation: classification.explanation as unknown as Prisma.InputJsonValue, modelKey: this.classifier.key, modelVersion: this.classifier.version } }));
        }
        await this.db.$transaction(operations);
        classifiedEvents += events.length; cursor = events.at(-1)!.id; await this.db.aiAnalysisJob.update({ where: { id }, data: { startedAt: new Date() } });
      }
      for (const value of structuredCategories.values()) categorySeconds.set(value.category, (categorySeconds.get(value.category) ?? 0) + value.seconds);
      const refreshedDashboard = await this.analytics.dashboard({ from: job.fromDate.toISOString(), to: job.toDate.toISOString() }, { id: job.requestedBy.id, organizationId: job.organizationId, role: job.requestedBy.role });
      const daily = this.dailyAverage(refreshedDashboard.trend); const result = this.insights.generate({ daily, categories: [...categorySeconds].map(([category, seconds]) => ({ category, seconds })) });
      await this.db.$transaction([
        this.db.aiAnalysisJob.update({ where: { id }, data: { status: 'COMPLETED', summary: result.summary as Prisma.InputJsonValue, insights: result.insights as Prisma.InputJsonValue, recommendations: result.recommendations as Prisma.InputJsonValue, completedAt: new Date() } }),
        this.db.notification.create({ data: { organizationId: job.organizationId, userId: job.requestedById, type: 'AI_ANALYSIS_COMPLETED', titleKey: 'notifications.aiAnalysisCompleted', data: { jobId: id } } }),
      ]);
      await this.audit.record({ organizationId: job.organizationId, actorId: job.requestedById, action: 'AI_ANALYSIS_COMPLETED', targetType: 'AiAnalysisJob', targetId: id, result: 'SUCCESS', metadata: { modelKey: this.classifier.key, modelVersion: this.classifier.version, classifiedEvents } });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown AI processing error'; this.logger.error(`AI job ${id} failed: ${message}`);
      await this.db.aiAnalysisJob.update({ where: { id }, data: { status: 'FAILED', errorMessage: 'Analysis processing failed', completedAt: new Date() } });
      await this.audit.record({ organizationId: job.organizationId, actorId: job.requestedById, action: 'AI_ANALYSIS_COMPLETED', targetType: 'AiAnalysisJob', targetId: id, result: 'FAILURE', metadata: { modelKey: this.classifier.key, modelVersion: this.classifier.version } });
    }
  }
  private dailyAverage(rows: Array<{ date: string; productivityScore: number; focusScore: number; activeSeconds: number; idleSeconds: number }>) { const groups = new Map<string, typeof rows>(); for (const row of rows) groups.set(row.date, [...(groups.get(row.date) ?? []), row]); return [...groups].map(([date, values]) => ({ date, productivityScore: Math.round(values.reduce((sum, row) => sum + row.productivityScore, 0) / values.length), focusScore: Math.round(values.reduce((sum, row) => sum + row.focusScore, 0) / values.length), activeSeconds: values.reduce((sum, row) => sum + row.activeSeconds, 0), idleSeconds: values.reduce((sum, row) => sum + row.idleSeconds, 0) })); }
  private payload(value: Prisma.JsonValue): Payload { return value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : {}; }
  private number(value: unknown, fallback = 0) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
  private string(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
}
