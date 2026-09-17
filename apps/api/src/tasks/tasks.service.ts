import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { AddTaskNoteDto, CreateTaskDto, UpdateProgressDto, UpdateTaskDto } from './dto';

export interface TaskActor { id: string; role: UserRole; organizationId: string | null }
const taskInclude = { assignee: { select: { id: true, displayName: true, email: true } }, notes: { include: { author: { select: { id: true, displayName: true } } }, orderBy: { createdAt: 'asc' as const } } };

@Injectable()
export class TasksService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}
  async list(actor: TaskActor) {
    const organizationId = this.organization(actor);
    return this.db.task.findMany({ where: { organizationId, deletedAt: null, ...(actor.role === 'EMPLOYEE' ? { assigneeId: actor.id } : {}) }, include: taskInclude, orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }] });
  }
  async create(dto: CreateTaskDto, actor: TaskActor) {
    const organizationId = this.organization(actor); await this.assertManager(actor); await this.validateAssignee(dto.assigneeId, organizationId);
    const task = await this.db.task.create({ data: { organizationId, title: dto.title.trim(), description: dto.description?.trim(), priority: dto.priority, deadline: dto.deadline ? new Date(dto.deadline) : null, assigneeId: dto.assigneeId, createdById: actor.id }, include: taskInclude });
    await this.db.notification.create({ data: { organizationId, userId: task.assigneeId, type: 'TASK_ASSIGNED', titleKey: 'notifications.taskAssigned', data: { taskId: task.id, title: task.title } } });
    await this.audit.record({ organizationId, actorId: actor.id, action: 'TASK_CREATED', targetType: 'Task', targetId: task.id, result: 'SUCCESS', metadata: { assigneeId: task.assigneeId, priority: task.priority } });
    return task;
  }
  async update(id: string, dto: UpdateTaskDto, actor: TaskActor) {
    await this.assertManager(actor); const task = await this.findAccessible(id, actor);
    if (dto.assigneeId) await this.validateAssignee(dto.assigneeId, task.organizationId);
    const resultingProgress = dto.progress ?? task.progress;
    if (dto.status === 'COMPLETED' && resultingProgress !== 100) throw new BadRequestException('Completed tasks require 100% progress');
    if (resultingProgress === 100 && dto.status && dto.status !== 'COMPLETED') throw new BadRequestException('100% progress requires completed status');
    const data = { ...dto, title: dto.title?.trim(), description: dto.description?.trim(), deadline: dto.deadline ? new Date(dto.deadline) : undefined };
    const updated = await this.db.task.update({ where: { id }, data, include: taskInclude });
    await this.db.notification.create({ data: { organizationId: task.organizationId, userId: updated.assigneeId, type: dto.assigneeId && dto.assigneeId !== task.assigneeId ? 'TASK_ASSIGNED' : 'TASK_UPDATED', titleKey: dto.assigneeId && dto.assigneeId !== task.assigneeId ? 'notifications.taskAssigned' : 'notifications.taskUpdated', data: { taskId: id, title: updated.title } } });
    await this.audit.record({ organizationId: task.organizationId, actorId: actor.id, action: 'TASK_UPDATED', targetType: 'Task', targetId: id, result: 'SUCCESS', metadata: { fields: Object.keys(dto) } });
    return updated;
  }
  async updateProgress(id: string, dto: UpdateProgressDto, actor: TaskActor) {
    const task = await this.findAccessible(id, actor); if (actor.role === 'EMPLOYEE' && task.assigneeId !== actor.id) throw new ForbiddenException();
    if (dto.status === 'COMPLETED' && dto.progress !== 100) throw new BadRequestException('Completed tasks require 100% progress');
    const status: TaskStatus = dto.progress === 100 ? 'COMPLETED' : (dto.status ?? (dto.progress > 0 ? 'IN_PROGRESS' : 'TODO'));
    const updated = await this.db.task.update({ where: { id }, data: { progress: dto.progress, status }, include: taskInclude });
    await this.audit.record({ organizationId: task.organizationId, actorId: actor.id, action: 'TASK_PROGRESS_UPDATED', targetType: 'Task', targetId: id, result: 'SUCCESS', metadata: { progress: dto.progress, status } });
    return updated;
  }
  async addNote(id: string, dto: AddTaskNoteDto, actor: TaskActor) {
    const task = await this.findAccessible(id, actor); if (actor.role === 'EMPLOYEE' && task.assigneeId !== actor.id) throw new ForbiddenException();
    const note = await this.db.taskNote.create({ data: { taskId: id, authorId: actor.id, content: dto.content.trim() }, include: { author: { select: { id: true, displayName: true } } } });
    await this.audit.record({ organizationId: task.organizationId, actorId: actor.id, action: 'TASK_NOTE_ADDED', targetType: 'Task', targetId: id, result: 'SUCCESS' }); return note;
  }
  async remove(id: string, actor: TaskActor) {
    await this.assertManager(actor); const task = await this.findAccessible(id, actor); await this.db.task.update({ where: { id }, data: { deletedAt: new Date(), status: 'CANCELLED' } });
    await this.audit.record({ organizationId: task.organizationId, actorId: actor.id, action: 'TASK_DELETED', targetType: 'Task', targetId: id, result: 'SUCCESS' });
  }
  private async findAccessible(id: string, actor: TaskActor) { const task = await this.db.task.findFirst({ where: { id, organizationId: this.organization(actor), deletedAt: null } }); if (!task) throw new NotFoundException('Task not found'); return task; }
  private organization(actor: TaskActor) { if (!actor.organizationId) throw new ForbiddenException('Organization membership required'); return actor.organizationId; }
  private async assertManager(actor: TaskActor) { if (!['ADMIN', 'MANAGER'].includes(actor.role)) throw new ForbiddenException(); }
  private async validateAssignee(id: string, organizationId: string) { const user = await this.db.user.findFirst({ where: { id, organizationId, role: 'EMPLOYEE', status: 'ACTIVE' } }); if (!user) throw new BadRequestException('Assignee must be an active employee in the organization'); }
}
