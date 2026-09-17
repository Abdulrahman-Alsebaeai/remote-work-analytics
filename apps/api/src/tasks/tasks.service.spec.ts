import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
describe('TasksService authorization and progress rules', () => {
  const db = { task: { findFirst: jest.fn(), update: jest.fn() }, user: { findFirst: jest.fn() }, taskNote: { create: jest.fn() } };
  const audit = { record: jest.fn() }; const service = new TasksService(db as never, audit as never);
  beforeEach(() => jest.clearAllMocks());
  it('prevents employees from creating tasks', async () => {
    await expect(service.create({ title: 'Task', priority: 'MEDIUM', assigneeId: 'employee' }, { id: 'employee', role: 'EMPLOYEE', organizationId: 'org' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('prevents an employee from updating another employee task', async () => {
    db.task.findFirst.mockResolvedValue({ id: 'task', organizationId: 'org', assigneeId: 'other' });
    await expect(service.updateProgress('task', { progress: 25 }, { id: 'employee', role: 'EMPLOYEE', organizationId: 'org' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('requires 100 percent progress for explicit completion', async () => {
    db.task.findFirst.mockResolvedValue({ id: 'task', organizationId: 'org', assigneeId: 'employee' });
    await expect(service.updateProgress('task', { progress: 80, status: 'COMPLETED' }, { id: 'employee', role: 'EMPLOYEE', organizationId: 'org' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('prevents changing a completed task status while progress remains 100', async () => {
    db.task.findFirst.mockResolvedValue({ id: 'task', organizationId: 'org', assigneeId: 'employee', progress: 100 });
    await expect(service.update('task', { status: 'IN_PROGRESS' }, { id: 'manager', role: 'MANAGER', organizationId: 'org' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
