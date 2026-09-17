import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { TaskActor } from '../tasks/tasks.service';
import { AnalyticsRangeDto } from './dto';
import { ActivitySample, calculateDailyScore, UsageItem } from './scoring';

type Payload = Record<string, unknown>;

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  async dashboard(range: AnalyticsRangeDto, actor: TaskActor) {
    if (!actor.organizationId) throw new ForbiddenException();
    const { from, to, endExclusive } = this.range(range);
    const employeeId = actor.role === 'EMPLOYEE' ? actor.id : range.employeeId;
    if (employeeId && actor.role !== 'EMPLOYEE') {
      const employee = await this.db.user.findFirst({ where: { id: employeeId, organizationId: actor.organizationId, role: 'EMPLOYEE' }, select: { id: true } });
      if (!employee) throw new ForbiddenException();
    }
    await this.aggregate(actor.organizationId, from, to, endExclusive, actor.id, employeeId);
    const [daily, sessions, taskGroups] = await Promise.all([
      this.db.dailyProductivity.findMany({ where: { organizationId: actor.organizationId, date: { gte: from, lte: to }, ...(employeeId ? { employeeId } : {}) }, include: { employee: { select: { displayName: true } } }, orderBy: [{ date: 'asc' }, { employeeId: 'asc' }] }),
      this.db.workSession.findMany({ where: { organizationId: actor.organizationId, startedAt: { gte: from, lt: endExclusive }, ...(employeeId ? { employeeId } : {}) }, select: { status: true, startedAt: true, endedAt: true } }),
      this.db.task.groupBy({ by: ['status'], where: { organizationId: actor.organizationId, deletedAt: null, ...(employeeId ? { assigneeId: employeeId } : {}) }, _count: { _all: true } }),
    ]);
    const totals = daily.reduce((value, row) => ({ trackedSeconds: value.trackedSeconds + row.trackedSeconds, activeSeconds: value.activeSeconds + row.activeSeconds, idleSeconds: value.idleSeconds + row.idleSeconds, productiveSeconds: value.productiveSeconds + row.productiveSeconds, unproductiveSeconds: value.unproductiveSeconds + row.unproductiveSeconds, undefinedSeconds: value.undefinedSeconds + row.undefinedSeconds, productivityWeighted: value.productivityWeighted + row.productivityScore * row.trackedSeconds, focusWeighted: value.focusWeighted + row.focusScore * row.trackedSeconds }), { trackedSeconds: 0, activeSeconds: 0, idleSeconds: 0, productiveSeconds: 0, unproductiveSeconds: 0, undefinedSeconds: 0, productivityWeighted: 0, focusWeighted: 0 });
    const score = (weighted: number) => totals.trackedSeconds ? Math.round(weighted / totals.trackedSeconds) : 0;
    const rankingMap = new Map<string, { employeeId: string; displayName: string; trackedSeconds: number; activeSeconds: number; idleSeconds: number; productivityWeighted: number; focusWeighted: number }>();
    for (const row of daily) { const current = rankingMap.get(row.employeeId) ?? { employeeId: row.employeeId, displayName: row.employee.displayName, trackedSeconds: 0, activeSeconds: 0, idleSeconds: 0, productivityWeighted: 0, focusWeighted: 0 }; current.trackedSeconds += row.trackedSeconds; current.activeSeconds += row.activeSeconds; current.idleSeconds += row.idleSeconds; current.productivityWeighted += row.productivityScore * row.trackedSeconds; current.focusWeighted += row.focusScore * row.trackedSeconds; rankingMap.set(row.employeeId, current); }
    const ranking = [...rankingMap.values()].map(row => ({ employeeId: row.employeeId, displayName: row.displayName, trackedSeconds: row.trackedSeconds, activeSeconds: row.activeSeconds, idleSeconds: row.idleSeconds, productivityScore: row.trackedSeconds ? Math.round(row.productivityWeighted / row.trackedSeconds) : 0, focusScore: row.trackedSeconds ? Math.round(row.focusWeighted / row.trackedSeconds) : 0 })).sort((a, b) => b.productivityScore - a.productivityScore || b.activeSeconds - a.activeSeconds);
    return {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), timezone: 'UTC' },
      summary: { productivityScore: score(totals.productivityWeighted), focusScore: score(totals.focusWeighted), trackedSeconds: totals.trackedSeconds, activeSeconds: totals.activeSeconds, idleSeconds: totals.idleSeconds, productiveSeconds: totals.productiveSeconds, unproductiveSeconds: totals.unproductiveSeconds, undefinedSeconds: totals.undefinedSeconds },
      ranking,
      trend: daily.map(row => ({ date: row.date.toISOString().slice(0, 10), employeeId: row.employeeId, displayName: row.employee.displayName, productivityScore: row.productivityScore, focusScore: row.focusScore, activeSeconds: row.activeSeconds, idleSeconds: row.idleSeconds, productiveSeconds: row.productiveSeconds, unproductiveSeconds: row.unproductiveSeconds, undefinedSeconds: row.undefinedSeconds })),
      applications: this.mergeUsage(daily.flatMap(row => row.applicationUsage as unknown as UsageItem[])), websites: this.mergeUsage(daily.flatMap(row => row.websiteUsage as unknown as UsageItem[])),
      sessions: { count: sessions.length, active: sessions.filter(row => row.status === 'ACTIVE').length, completed: sessions.filter(row => row.status === 'ENDED').length, durationSeconds: sessions.reduce((sum, row) => sum + Math.max(0, ((row.endedAt ?? new Date()).valueOf() - row.startedAt.valueOf()) / 1000), 0) },
      tasks: Object.fromEntries(taskGroups.map(row => [row.status, row._count._all])),
    };
  }

  private async aggregate(organizationId: string, from: Date, to: Date, endExclusive: Date, actorId: string, employeeId?: string) {
    const [activities, events] = await Promise.all([
      this.db.activitySession.findMany({
        where: { organizationId, startedAt: { lt: endExclusive }, endedAt: { gte: from }, ...(employeeId ? { employeeId } : {}) },
        select: { employeeId: true, startedAt: true, endedAt: true, durationSeconds: true, idleSeconds: true, keyboardActivity: true, mouseActivity: true, windowSwitches: true, applicationName: true, resourceType: true, domain: true, resourceName: true, classification: true },
      }),
      this.db.agentEvent.findMany({ where: { organizationId, type: 'ACTIVITY_SAMPLE', occurredAt: { gte: from, lt: endExclusive }, ...(employeeId ? { employeeId } : {}) }, select: { employeeId: true, occurredAt: true, payload: true } }),
    ]);
    const groups = new Map<string, { employeeId: string; date: Date; samples: ActivitySample[] }>();
    const add = (employee: string, date: Date, sample: ActivitySample) => { const key = `${employee}:${date.toISOString()}`; const group = groups.get(key) ?? { employeeId: employee, date, samples: [] }; group.samples.push(sample); groups.set(key, group); };
    for (const activity of activities) {
      let day = new Date(Math.max(from.valueOf(), Date.UTC(activity.startedAt.getUTCFullYear(), activity.startedAt.getUTCMonth(), activity.startedAt.getUTCDate())));
      while (day < endExclusive && day <= activity.endedAt) {
        const nextDay = new Date(day.valueOf() + 86400000);
        const segmentStart = new Date(Math.max(day.valueOf(), activity.startedAt.valueOf(), from.valueOf()));
        const segmentEnd = new Date(Math.min(nextDay.valueOf(), activity.endedAt.valueOf(), endExclusive.valueOf()));
        const segmentSeconds = Math.max(0, Math.round((segmentEnd.valueOf() - segmentStart.valueOf()) / 1000));
        if (segmentSeconds) {
          const ratio = segmentSeconds / Math.max(1, activity.durationSeconds);
          add(activity.employeeId, day, { duration: segmentSeconds, idleSeconds: 0, idleDuration: Math.round(activity.idleSeconds * ratio), keyboardActivity: Math.round(activity.keyboardActivity * ratio), mouseActivity: Math.round(activity.mouseActivity * ratio), windowSwitches: Math.round(activity.windowSwitches * ratio), application: activity.applicationName, website: activity.resourceType === 'WEBSITE' ? activity.domain ?? activity.resourceName ?? undefined : undefined, classification: activity.classification });
        }
        day = nextDay;
      }
    }
    for (const event of events) {
      const payload = this.payload(event.payload);
      if (this.string(payload.activityId)) continue;
      const date = new Date(`${event.occurredAt.toISOString().slice(0, 10)}T00:00:00.000Z`);
      add(event.employeeId, date, { duration: this.number(payload.sampleDurationSeconds, 10), idleSeconds: this.number(payload.idleSeconds), keyboardActivity: this.number(payload.keyboardActivity), mouseActivity: this.number(payload.mouseActivity), windowSwitches: this.number(payload.windowSwitches), application: this.string(payload.activeApplication), website: this.string(payload.websiteTitle), classification: 'UNDEFINED' });
    }
    const writes = [...groups.values()].map(group => { const score = calculateDailyScore(group.samples); return this.db.dailyProductivity.upsert({ where: { organizationId_employeeId_date: { organizationId, employeeId: group.employeeId, date: group.date } }, update: { ...score, applicationUsage: score.applicationUsage as unknown as Prisma.InputJsonValue, websiteUsage: score.websiteUsage as unknown as Prisma.InputJsonValue, calculatedAt: new Date() }, create: { organizationId, employeeId: group.employeeId, date: group.date, ...score, applicationUsage: score.applicationUsage as unknown as Prisma.InputJsonValue, websiteUsage: score.websiteUsage as unknown as Prisma.InputJsonValue } }); });
    await this.db.$transaction([this.db.dailyProductivity.deleteMany({ where: { organizationId, date: { gte: from, lte: to }, ...(employeeId ? { employeeId } : {}) } }), ...writes]);
    await this.audit.record({ organizationId, actorId, action: 'ANALYTICS_AGGREGATED', targetType: 'DailyProductivity', result: 'SUCCESS', metadata: { from: from.toISOString(), to: to.toISOString(), rows: groups.size } });
  }

  private range(range: AnalyticsRangeDto) { const today = new Date(); const to = range.to ? new Date(`${range.to.slice(0, 10)}T00:00:00.000Z`) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); const from = range.from ? new Date(`${range.from.slice(0, 10)}T00:00:00.000Z`) : new Date(to.valueOf() - 6 * 86400000); if (from > to || to.valueOf() - from.valueOf() > 30 * 86400000) throw new BadRequestException('Analytics range must be between 1 and 31 days'); return { from, to, endExclusive: new Date(to.valueOf() + 86400000) }; }
  private payload(value: Prisma.JsonValue): Payload { return value && typeof value === 'object' && !Array.isArray(value) ? value as Payload : {}; }
  private number(value: unknown, fallback = 0) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
  private string(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
  private mergeUsage(items: UsageItem[]) { const values = new Map<string, number>(); for (const item of items) if (item && typeof item.name === 'string' && typeof item.seconds === 'number') values.set(item.name, (values.get(item.name) ?? 0) + item.seconds); return [...values].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds).slice(0, 20); }
}
