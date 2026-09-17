import { ForbiddenException } from '@nestjs/common';
import { AgentSyncService } from './agent-sync.service';
describe('AgentSyncService access boundary', () => {
  const service = new AgentSyncService({} as never, { record: jest.fn() } as never);
  it('rejects manager identities at the employee synchronization endpoint', async () => {
    await expect(service.synchronize([{ id: 'd9428888-122b-11e1-b85c-61cd3cbb3210', sessionId: 'd9428888-122b-11e1-b85c-61cd3cbb3211', type: 'SESSION_STARTED', occurredAt: new Date().toISOString() }], { id: 'manager', role: 'MANAGER', organizationId: 'org' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('upserts cumulative structured activity records idempotently by activity id', async () => {
    const tx = {
      agentEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(undefined) },
      workSession: { findUnique: jest.fn().mockResolvedValue({ id: 'd9428888-122b-41e1-b85c-61cd3cbb3211', employeeId: 'employee-1', organizationId: 'org-1', status: 'ACTIVE', startedAt: new Date('2026-08-12T08:00:00Z'), endedAt: null }) },
      activitySession: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue(undefined) },
    };
    const db = { $transaction: jest.fn().mockImplementation(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AgentSyncService(db as never, audit as never);
    const activityId = 'd9428888-122b-41e1-b85c-61cd3cbb3222';
    const event = {
      id: 'd9428888-122b-41e1-b85c-61cd3cbb3233', sessionId: 'd9428888-122b-41e1-b85c-61cd3cbb3211', type: 'ACTIVITY_SAMPLE' as const, occurredAt: '2026-08-12T08:01:00Z',
      payload: { activityId, activityType: 'FILE', applicationName: 'Visual Studio Code', processName: 'Code.exe', resourceName: 'main.ts', contextName: 'RemoteWorkAnalytics', startedAt: '2026-08-12T08:00:50Z', endedAt: '2026-08-12T08:01:00Z', durationSeconds: 10, idleSeconds: 0, keyboardActivity: 12, mouseActivity: 4, windowSwitches: 0 },
    };
    await expect(service.synchronize([event], { id: 'employee-1', role: 'EMPLOYEE', organizationId: 'org-1' })).resolves.toEqual({ acknowledged: [event.id] });
    expect(tx.activitySession.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: activityId }, create: expect.objectContaining({ resourceType: 'FILE', resourceName: 'main.ts', durationSeconds: 10 }) }));
  });

  it('normalizes legacy Word samples into a continuous structured activity', async () => {
    const session = { id: 'd9428888-122b-41e1-b85c-61cd3cbb3211', employeeId: 'employee-1', organizationId: 'org-1', status: 'ACTIVE', startedAt: new Date('2026-08-12T08:00:00Z'), endedAt: null };
    const existing = { id: 'd9428888-122b-41e1-b85c-61cd3cbb3299', resourceType: 'FILE', applicationName: 'Microsoft Word', processName: 'WINWORD.EXE', windowTitle: 'Project Report.docx - Word', resourceName: 'Project Report.docx', contextName: 'Word', startedAt: new Date('2026-08-12T08:00:00Z'), endedAt: new Date('2026-08-12T08:00:10Z'), idleSeconds: 0, keyboardActivity: 2, mouseActivity: 1, windowSwitches: 0 };
    const tx = {
      agentEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(undefined) },
      workSession: { findUnique: jest.fn().mockResolvedValue(session) },
      activitySession: { findFirst: jest.fn().mockResolvedValue(existing), update: jest.fn().mockResolvedValue(undefined), create: jest.fn().mockResolvedValue(undefined) },
    };
    const db = { $transaction: jest.fn().mockImplementation(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)) };
    const service = new AgentSyncService(db as never, { record: jest.fn().mockResolvedValue(undefined) } as never);
    const event = { id: 'd9428888-122b-41e1-b85c-61cd3cbb3233', sessionId: session.id, type: 'ACTIVITY_SAMPLE' as const, occurredAt: '2026-08-12T08:00:20Z', payload: { activeApplication: 'WINWORD.EXE', activeWindowTitle: 'Project Report.docx - Word', sampleDurationSeconds: 10, idleSeconds: 0, keyboardActivity: 3, mouseActivity: 2, windowSwitches: 0 } };

    await service.synchronize([event], { id: 'employee-1', role: 'EMPLOYEE', organizationId: 'org-1' });

    expect(tx.activitySession.create).not.toHaveBeenCalled();
    expect(tx.activitySession.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: existing.id }, data: expect.objectContaining({ durationSeconds: 20, keyboardActivity: 5, mouseActivity: 3 }) }));
  });

  it('closes the latest activity when an active session is paused', async () => {
    const session = { id: 'd9428888-122b-41e1-b85c-61cd3cbb3211', employeeId: 'employee-1', organizationId: 'org-1', status: 'ACTIVE', startedAt: new Date('2026-08-12T08:00:00Z'), endedAt: null, lastEventAt: new Date('2026-08-12T08:00:10Z') };
    const current = { id: 'd9428888-122b-41e1-b85c-61cd3cbb3299', startedAt: new Date('2026-08-12T08:00:00Z'), endedAt: new Date('2026-08-12T08:00:10Z') };
    const tx = {
      agentEvent: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(undefined) },
      workSession: { findUnique: jest.fn().mockResolvedValue(session), update: jest.fn().mockResolvedValue(undefined) },
      activitySession: { findFirst: jest.fn().mockResolvedValue(current), update: jest.fn().mockResolvedValue(undefined) },
    };
    const db = { $transaction: jest.fn().mockImplementation(async (callback: (client: unknown) => Promise<unknown>) => callback(tx)) };
    const service = new AgentSyncService(db as never, { record: jest.fn().mockResolvedValue(undefined) } as never);
    const event = { id: 'd9428888-122b-41e1-b85c-61cd3cbb3233', sessionId: session.id, type: 'SESSION_PAUSED' as const, occurredAt: '2026-08-12T08:00:18Z' };

    await service.synchronize([event], { id: 'employee-1', role: 'EMPLOYEE', organizationId: 'org-1' });

    expect(tx.activitySession.update).toHaveBeenCalledWith({ where: { id: current.id }, data: { endedAt: new Date('2026-08-12T08:00:18Z'), durationSeconds: 18 } });
  });
});
