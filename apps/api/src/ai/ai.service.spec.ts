import { ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  const classifier = { key: 'classifier', version: '1.0', classify: jest.fn() };
  const insights = { generate: jest.fn() };
  it('persists and audits a manager analysis request before processing', async () => {
    const job = { id: 'job-1', status: 'PENDING' }; const db = { aiAnalysisJob: { create: jest.fn().mockResolvedValue(job) } }; const audit = { record: jest.fn() };
    const service = new AiService(db as never, audit as never, {} as never, classifier as never, insights as never); const drain = jest.spyOn(service, 'drain').mockResolvedValue();
    await expect(service.create({ from: '2026-08-01', to: '2026-08-03' }, { id: 'manager-1', organizationId: 'org-1', role: 'MANAGER' } as never)).resolves.toBe(job);
    expect(db.aiAnalysisJob.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', modelKey: 'classifier', modelVersion: '1.0' }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'AI_ANALYSIS_REQUESTED', actorId: 'manager-1' })); await new Promise(resolve => setImmediate(resolve)); expect(drain).toHaveBeenCalled();
  });
  it('rejects employee-created organization analyses', async () => { const service = new AiService({} as never, {} as never, {} as never, classifier as never, insights as never); await expect(service.create({ from: '2026-08-01', to: '2026-08-03' }, { id: 'employee-1', organizationId: 'org-1', role: 'EMPLOYEE' } as never)).rejects.toBeInstanceOf(ForbiddenException); });
});
