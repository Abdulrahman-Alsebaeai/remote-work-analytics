import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  it('applies tenant, date, type, search, and pagination filters', async () => {
    const db = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
      activitySession: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(21) },
      $transaction: jest.fn().mockImplementation(async (values: Promise<unknown>[]) => Promise.all(values)),
    };
    const service = new ActivitiesService(db as never);
    const result = await service.list(
      { id: 'manager-1', role: 'MANAGER', organizationId: 'org-1' } as never,
      { employeeId: 'employee-1', from: '2026-08-01', to: '2026-08-07', type: 'WEBSITE', search: 'example', page: 2, pageSize: 10 },
    );
    expect(result).toEqual(expect.objectContaining({ total: 21, page: 2, totalPages: 3 }));
    expect(db.activitySession.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ organizationId: 'org-1', employeeId: 'employee-1', resourceType: 'WEBSITE' }) }));
  });

  it('prevents cross-organization employee access', async () => {
    const db = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ActivitiesService(db as never);
    await expect(service.list({ id: 'manager', role: 'MANAGER', organizationId: 'org-1' } as never, { employeeId: 'employee-other' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects reversed activity ranges', async () => {
    const db = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-1' }) } };
    const service = new ActivitiesService(db as never);
    await expect(service.list({ id: 'manager', role: 'MANAGER', organizationId: 'org-1' } as never, { employeeId: 'employee-1', from: '2026-08-07', to: '2026-08-01' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
