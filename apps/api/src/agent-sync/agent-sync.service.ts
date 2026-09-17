import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ActivityResourceType, AgentEventType, Prisma, WorkSessionStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { TaskActor } from '../tasks/tasks.service';
import { AgentEventDto } from './dto';

@Injectable()
export class AgentSyncService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}
  async synchronize(events: AgentEventDto[], actor: TaskActor) {
    if (actor.role !== 'EMPLOYEE' || !actor.organizationId) throw new ForbiddenException('Employee agent access required');
    const acknowledged: string[] = [];
    for (const event of events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      const accepted = await this.db.$transaction(tx => this.accept(tx, event, actor));
      if (accepted) acknowledged.push(event.id);
    }
    await this.audit.record({ organizationId: actor.organizationId, actorId: actor.id, action: 'AGENT_EVENTS_SYNCHRONIZED', targetType: 'AgentEvent', result: 'SUCCESS', metadata: { count: acknowledged.length } });
    return { acknowledged };
  }
  private async accept(tx: Prisma.TransactionClient, event: AgentEventDto, actor: TaskActor) {
    if (await tx.agentEvent.findUnique({ where: { id: event.id } })) return true;
    const occurredAt = new Date(event.occurredAt);
    const session = await tx.workSession.findUnique({ where: { id: event.sessionId } });
    if (event.type === 'SESSION_STARTED') {
      if (session && session.employeeId !== actor.id) throw new ForbiddenException();
      await tx.workSession.upsert({ where: { id: event.sessionId }, update: {}, create: { id: event.sessionId, organizationId: actor.organizationId!, employeeId: actor.id, status: 'ACTIVE', startedAt: occurredAt, lastEventAt: occurredAt } });
    } else if (event.type === 'ACTIVITY_SAMPLE') {
      if (!session || session.employeeId !== actor.id || session.organizationId !== actor.organizationId) throw new BadRequestException('Activity requires a known work session');
      const structured = this.structuredActivity(event.payload);
      if (!structured && session.status !== 'ACTIVE') throw new BadRequestException('Legacy activity requires an active work session');
      if (structured) {
        if (structured.startedAt < new Date(session.startedAt.valueOf() - 5000)) throw new BadRequestException('Activity predates its work session');
        if (session.endedAt && structured.endedAt > new Date(session.endedAt.valueOf() + 30_000)) throw new BadRequestException('Activity exceeds its work session');
        const existing = await tx.activitySession.findUnique({ where: { id: structured.id }, select: { employeeId: true, organizationId: true, sessionId: true } });
        if (existing && (existing.employeeId !== actor.id || existing.organizationId !== actor.organizationId || existing.sessionId !== event.sessionId)) throw new ForbiddenException();
        await tx.activitySession.upsert({
          where: { id: structured.id },
          update: structured.data,
          create: { id: structured.id, organizationId: actor.organizationId!, employeeId: actor.id, sessionId: event.sessionId, ...structured.data },
        });
      } else {
        await this.acceptLegacyActivity(tx, event, actor, session.startedAt, occurredAt);
      }
    } else {
      if (!session || session.employeeId !== actor.id || session.organizationId !== actor.organizationId) throw new BadRequestException('Unknown work session');
      if (occurredAt < session.lastEventAt) throw new BadRequestException('Out-of-order session event');
      if (session.status === 'ACTIVE' && (event.type === 'SESSION_PAUSED' || event.type === 'SESSION_ENDED')) {
        await this.closeLatestActivity(tx, event.sessionId, occurredAt);
      }
      const status = this.nextStatus(session.status, event.type);
      await tx.workSession.update({ where: { id: session.id }, data: { status, lastEventAt: occurredAt, endedAt: status === 'ENDED' ? occurredAt : undefined } });
    }
    await tx.agentEvent.create({ data: { id: event.id, organizationId: actor.organizationId!, employeeId: actor.id, sessionId: event.sessionId, type: event.type, occurredAt, payload: event.payload as Prisma.InputJsonValue | undefined } });
    return true;
  }
  private nextStatus(current: WorkSessionStatus, event: AgentEventType): WorkSessionStatus {
    const transitions: Record<WorkSessionStatus, Partial<Record<AgentEventType, WorkSessionStatus>>> = { ACTIVE: { SESSION_PAUSED: 'PAUSED', SESSION_ENDED: 'ENDED' }, PAUSED: { SESSION_RESUMED: 'ACTIVE', SESSION_ENDED: 'ENDED' }, ENDED: {} };
    const next = transitions[current][event]; if (!next) throw new BadRequestException(`Invalid transition from ${current}`); return next;
  }

  private structuredActivity(payloadValue?: Record<string, unknown>) {
    const payload = payloadValue ?? {};
    const id = this.text(payload.activityId, 36);
    if (!id) return undefined;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid activity identifier');
    const startedAt = new Date(this.text(payload.startedAt, 50) ?? '');
    const endedAt = new Date(this.text(payload.endedAt, 50) ?? '');
    if (Number.isNaN(startedAt.valueOf()) || Number.isNaN(endedAt.valueOf()) || endedAt < startedAt) throw new BadRequestException('Invalid activity time range');
    const durationSeconds = this.integer(payload.durationSeconds, 1, 7 * 86400);
    const measuredSeconds = Math.max(1, Math.round((endedAt.valueOf() - startedAt.valueOf()) / 1000));
    if (Math.abs(durationSeconds - measuredSeconds) > 5) throw new BadRequestException('Invalid activity duration');
    const resourceType = this.text(payload.activityType, 20) as ActivityResourceType;
    if (!['APPLICATION', 'WEBSITE', 'FILE', 'FOLDER', 'WORKSPACE', 'OTHER'].includes(resourceType)) throw new BadRequestException('Invalid activity type');
    const applicationName = this.text(payload.applicationName, 160) ?? this.text(payload.activeApplication, 160) ?? 'Unknown application';
    const processName = this.text(payload.processName, 160) ?? applicationName;
    return {
      id,
      startedAt,
      endedAt,
      data: {
        resourceType,
        applicationName,
        processName,
        windowTitle: this.text(payload.activeWindowTitle, 1000),
        resourceName: this.text(payload.resourceName, 500),
        contextName: this.text(payload.contextName, 500),
        url: this.text(payload.url, 2048),
        domain: this.text(payload.domain, 253),
        startedAt,
        endedAt,
        durationSeconds,
        idleSeconds: Math.min(durationSeconds, this.integer(payload.idleSeconds, 0, 7 * 86400)),
        keyboardActivity: this.integer(payload.keyboardActivity, 0, 10_000_000),
        mouseActivity: this.integer(payload.mouseActivity, 0, 10_000_000),
        windowSwitches: this.integer(payload.windowSwitches, 0, 1_000_000),
      },
    };
  }

  private async acceptLegacyActivity(tx: Prisma.TransactionClient, event: AgentEventDto, actor: TaskActor, sessionStartedAt: Date, occurredAt: Date) {
    const payload = event.payload ?? {};
    const sampleSeconds = this.optionalInteger(payload.sampleDurationSeconds, 10, 1, 300);
    const startedAt = new Date(Math.max(sessionStartedAt.valueOf(), occurredAt.valueOf() - sampleSeconds * 1000));
    const context = this.legacyContext(payload);
    const latest = await tx.activitySession.findFirst({
      where: { sessionId: event.sessionId, employeeId: actor.id, organizationId: actor.organizationId! },
      orderBy: [{ endedAt: 'desc' }, { createdAt: 'desc' }],
    });
    const continuous = latest
      && this.sameContext(latest, context)
      && startedAt.valueOf() <= latest.endedAt.valueOf() + Math.max(15, sampleSeconds * 2) * 1000;
    const idleSeconds = Math.min(sampleSeconds, this.optionalInteger(payload.idleSeconds, 0, 0, 300));
    const keyboardActivity = this.optionalInteger(payload.keyboardActivity, 0, 0, 10_000_000);
    const mouseActivity = this.optionalInteger(payload.mouseActivity, 0, 0, 10_000_000);
    const windowSwitches = this.optionalInteger(payload.windowSwitches, 0, 0, 1_000_000);
    if (continuous) {
      const durationSeconds = Math.max(1, Math.round((occurredAt.valueOf() - latest.startedAt.valueOf()) / 1000));
      await tx.activitySession.update({
        where: { id: latest.id },
        data: {
          endedAt: occurredAt,
          durationSeconds,
          idleSeconds: Math.min(durationSeconds, latest.idleSeconds + idleSeconds),
          keyboardActivity: latest.keyboardActivity + keyboardActivity,
          mouseActivity: latest.mouseActivity + mouseActivity,
          windowSwitches: latest.windowSwitches + windowSwitches,
        },
      });
      return;
    }
    await tx.activitySession.create({
      data: {
        id: event.id,
        organizationId: actor.organizationId!,
        employeeId: actor.id,
        sessionId: event.sessionId,
        ...context,
        startedAt,
        endedAt: occurredAt,
        durationSeconds: Math.max(1, Math.round((occurredAt.valueOf() - startedAt.valueOf()) / 1000)),
        idleSeconds,
        keyboardActivity,
        mouseActivity,
        windowSwitches,
      },
    });
  }

  private legacyContext(payload: Record<string, unknown>) {
    const processName = this.text(payload.activeApplication, 160) ?? 'unknown';
    const applicationName = this.friendlyApplicationName(processName);
    const windowTitle = this.text(payload.activeWindowTitle, 1000);
    const websiteTitle = this.text(payload.websiteTitle, 500);
    const process = processName.toLowerCase();
    const parts = this.titleParts(windowTitle);
    if (['msedge.exe', 'chrome.exe', 'firefox.exe', 'brave.exe'].includes(process)) {
      return { resourceType: 'WEBSITE' as ActivityResourceType, applicationName, processName, windowTitle, resourceName: websiteTitle ?? parts[0] ?? windowTitle, contextName: null, url: null, domain: null };
    }
    if (process === 'explorer.exe') {
      const folder = parts[0] ?? windowTitle;
      return { resourceType: 'FOLDER' as ActivityResourceType, applicationName, processName, windowTitle, resourceName: folder, contextName: folder, url: null, domain: null };
    }
    if (['code.exe', 'code - insiders.exe', 'cursor.exe'].includes(process)) {
      const resourceName = parts[0] ?? windowTitle;
      return { resourceType: this.looksLikeFile(resourceName) ? 'FILE' as ActivityResourceType : 'WORKSPACE' as ActivityResourceType, applicationName, processName, windowTitle, resourceName, contextName: parts[1] ?? null, url: null, domain: null };
    }
    if (['notepad.exe', 'winword.exe', 'excel.exe', 'powerpnt.exe', 'acrord32.exe'].includes(process)) {
      return { resourceType: 'FILE' as ActivityResourceType, applicationName, processName, windowTitle, resourceName: parts[0] ?? windowTitle, contextName: parts[1] ?? null, url: null, domain: null };
    }
    return { resourceType: 'APPLICATION' as ActivityResourceType, applicationName, processName, windowTitle, resourceName: windowTitle, contextName: null, url: null, domain: null };
  }

  private async closeLatestActivity(tx: Prisma.TransactionClient, sessionId: string, endedAt: Date) {
    const latest = await tx.activitySession.findFirst({ where: { sessionId }, orderBy: [{ endedAt: 'desc' }, { createdAt: 'desc' }] });
    if (!latest || endedAt <= latest.endedAt || endedAt.valueOf() - latest.endedAt.valueOf() > 30_000) return;
    await tx.activitySession.update({ where: { id: latest.id }, data: { endedAt, durationSeconds: Math.max(1, Math.round((endedAt.valueOf() - latest.startedAt.valueOf()) / 1000)) } });
  }

  private sameContext(current: { resourceType: ActivityResourceType; applicationName: string; processName: string; windowTitle: string | null; resourceName: string | null; contextName: string | null }, next: { resourceType: ActivityResourceType; applicationName: string; processName: string; windowTitle?: string | null; resourceName?: string | null; contextName?: string | null }) {
    return current.resourceType === next.resourceType
      && current.applicationName === next.applicationName
      && current.processName.toLowerCase() === next.processName.toLowerCase()
      && current.windowTitle === (next.windowTitle ?? null)
      && current.resourceName === (next.resourceName ?? null)
      && current.contextName === (next.contextName ?? null);
  }

  private friendlyApplicationName(processName: string) {
    const names: Record<string, string> = {
      'msedge.exe': 'Microsoft Edge', 'chrome.exe': 'Google Chrome', 'firefox.exe': 'Mozilla Firefox', 'brave.exe': 'Brave',
      'code.exe': 'Visual Studio Code', 'code - insiders.exe': 'Visual Studio Code Insiders', 'cursor.exe': 'Cursor',
      'explorer.exe': 'File Explorer', 'notepad.exe': 'Notepad', 'winword.exe': 'Microsoft Word', 'excel.exe': 'Microsoft Excel',
      'powerpnt.exe': 'Microsoft PowerPoint', 'acrord32.exe': 'Adobe Acrobat Reader', 'teams.exe': 'Microsoft Teams', 'ms-teams.exe': 'Microsoft Teams', 'zoom.exe': 'Zoom',
    };
    const normalized = processName.toLowerCase();
    return names[normalized] ?? (processName.replace(/\.exe$/i, '') || 'Unknown application');
  }

  private titleParts(value?: string) { return (value ?? '').replace(/\s+[—–-]\s+/g, ' - ').split(' - ').map(part => part.trim()).filter(Boolean); }
  private looksLikeFile(value?: string | null) { return Boolean(value && /(?:^|[^.])\.[a-z0-9]{1,12}$/i.test(value.trim().replace(/^[●•*]\s*/, ''))); }
  private optionalInteger(value: unknown, fallback: number, min: number, max: number) { return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback; }

  private text(value: unknown, max: number) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined; }
  private integer(value: unknown, min: number, max: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequestException('Invalid activity metric');
    return Math.min(max, Math.max(min, Math.round(value)));
  }
}
