import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma.service';
import { TaskActor } from '../tasks/tasks.service';
import { ListActivitiesQueryDto } from './dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly db: PrismaService) {}

  async list(actor: TaskActor, query: ListActivitiesQueryDto) {
    if (!actor.organizationId) throw new ForbiddenException();
    const employeeId = actor.role === 'EMPLOYEE' ? actor.id : query.employeeId;
    if (!employeeId) throw new BadRequestException('Employee is required');
    if (actor.role !== 'EMPLOYEE') {
      const employee = await this.db.user.findFirst({ where: { id: employeeId, organizationId: actor.organizationId, role: 'EMPLOYEE' }, select: { id: true } });
      if (!employee) throw new ForbiddenException();
    }
    const { from, endExclusive } = this.range(query.from, query.to);
    const search = query.search?.trim();
    const where: Prisma.ActivitySessionWhereInput = {
      organizationId: actor.organizationId,
      employeeId,
      ...(query.type ? { resourceType: query.type } : {}),
      ...(from || endExclusive ? { AND: [
        ...(endExclusive ? [{ startedAt: { lt: endExclusive } }] : []),
        ...(from ? [{ endedAt: { gte: from } }] : []),
      ] } : {}),
      ...(search ? { OR: [
        { applicationName: { contains: search } },
        { windowTitle: { contains: search } },
        { resourceName: { contains: search } },
        { contextName: { contains: search } },
        { domain: { contains: search } },
      ] } : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.db.$transaction([
      this.db.activitySession.findMany({
        where,
        select: {
          id: true, resourceType: true, applicationName: true, processName: true,
          windowTitle: true, resourceName: true, contextName: true, url: true, domain: true,
          startedAt: true, endedAt: true, durationSeconds: true, idleSeconds: true,
          keyboardActivity: true, mouseActivity: true, windowSwitches: true, classification: true,
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.activitySession.count({ where }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  private range(fromValue?: string, toValue?: string) {
    const from = fromValue ? new Date(`${fromValue.slice(0, 10)}T00:00:00.000Z`) : undefined;
    const to = toValue ? new Date(`${toValue.slice(0, 10)}T00:00:00.000Z`) : undefined;
    if ((from && Number.isNaN(from.valueOf())) || (to && Number.isNaN(to.valueOf())) || (from && to && from > to)) throw new BadRequestException('Invalid activity date range');
    if (from && to && to.valueOf() - from.valueOf() > 30 * 86400000) throw new BadRequestException('Activity range must be between 1 and 31 days');
    return { from, endExclusive: to ? new Date(to.valueOf() + 86400000) : undefined };
  }
}
