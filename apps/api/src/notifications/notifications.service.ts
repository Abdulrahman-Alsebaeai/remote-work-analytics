import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service';
import { TaskActor } from '../tasks/tasks.service';
@Injectable()
export class NotificationsService {
  constructor(private readonly db: PrismaService) {}
  list(actor: TaskActor) { return this.db.notification.findMany({ where: { userId: actor.id, organizationId: actor.organizationId ?? '__none__' }, orderBy: { createdAt: 'desc' }, take: 100 }); }
  async markRead(id: string, actor: TaskActor) { const result = await this.db.notification.updateMany({ where: { id, userId: actor.id }, data: { readAt: new Date() } }); if (!result.count) throw new NotFoundException('Notification not found'); }
}
