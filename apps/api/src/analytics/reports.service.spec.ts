import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const dashboard = { range: { from: '2026-08-01', to: '2026-08-03', timezone: 'UTC' }, summary: { productivityScore: 80, focusScore: 75, trackedSeconds: 100, activeSeconds: 80, idleSeconds: 20 }, ranking: [{ employeeId: '1', displayName: 'موظف, One', productivityScore: 80, focusScore: 75, trackedSeconds: 100, activeSeconds: 80, idleSeconds: 20 }], trend: [], applications: [], websites: [], sessions: { count: 1, active: 0, completed: 1, durationSeconds: 100 }, tasks: {} };
  it('exports a UTF-8 CSV and records an audit event', async () => {
    const analytics = { dashboard: jest.fn().mockResolvedValue(dashboard) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new ReportsService(analytics as never, audit as never);
    const report = await service.export({ format: 'csv' }, { id: 'manager-1', organizationId: 'org-1', role: 'MANAGER' } as never);
    expect(report.contentType).toContain('text/csv'); expect(report.bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(report.bytes.toString('utf8')).toContain('موظف, One');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'REPORT_EXPORTED', actorId: 'manager-1' }));
  });

  it.each([['xlsx', 'PK'], ['pdf', '%PDF']])('creates a valid %s file', async (format, signature) => {
    const service = new ReportsService({ dashboard: jest.fn().mockResolvedValue(dashboard) } as never, { record: jest.fn() } as never);
    const report = await service.export({ format } as never, { id: 'manager-1', organizationId: 'org-1', role: 'MANAGER' } as never);
    expect(report.bytes.subarray(0, signature.length).toString()).toBe(signature);
  });
});
