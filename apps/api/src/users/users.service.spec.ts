import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService tenant and role boundaries', () => {
  const db = { user: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }, department: { findFirst: jest.fn() }, team: { findFirst: jest.fn() } };
  const audit = { record: jest.fn() };
  const service = new UsersService(db as never, audit as never);
  beforeEach(() => jest.clearAllMocks());

  it('scopes manager listings to the manager organization', async () => {
    db.user.findMany.mockResolvedValue([]);
    await service.list({ id: 'actor', role: 'MANAGER', organizationId: 'org-1' });
    expect(db.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }));
  });

  it('prevents managers from creating privileged users', async () => {
    await expect(service.create({ email: 'admin@example.com', password: 'long-password', displayName: 'Admin', role: 'ADMIN' }, { id: 'actor', role: 'MANAGER', organizationId: 'org-1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.user.create).not.toHaveBeenCalled();
  });
});
