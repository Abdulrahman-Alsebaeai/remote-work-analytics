import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const publicUser = { id: true, email: true, displayName: true, role: true, status: true, locale: true, organizationId: true, departmentId: true, teamId: true, createdAt: true } as const;
export interface RequestActor { id: string; role: UserRole; organizationId: string | null }

@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}
  async list(actor: RequestActor) {
    return this.db.user.findMany({ where: actor.role === 'ADMIN' ? {} : { organizationId: actor.organizationId ?? '__none__' }, select: publicUser, orderBy: { displayName: 'asc' } });
  }
  async get(id: string, actor: RequestActor) {
    const user = await this.db.user.findFirst({ where: { id, ...(actor.role === 'ADMIN' ? {} : { organizationId: actor.organizationId ?? '__none__' }) }, select: publicUser });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  async create(dto: CreateUserDto, actor: RequestActor) {
    if (!actor.organizationId) throw new BadRequestException('Actor must belong to an organization');
    if (actor.role !== 'ADMIN' && dto.role !== 'EMPLOYEE') throw new BadRequestException('Managers can create employees only');
    await this.validatePlacement(actor.organizationId, dto.departmentId, dto.teamId);
    try {
      const user = await this.db.user.create({ data: { email: dto.email.trim().toLowerCase(), passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }), displayName: dto.displayName.trim(), role: dto.role, organizationId: actor.organizationId, departmentId: dto.departmentId, teamId: dto.teamId }, select: publicUser });
      await this.audit.record({ organizationId: actor.organizationId, actorId: actor.id, action: 'USER_CREATED', targetType: 'User', targetId: user.id, result: 'SUCCESS', metadata: { role: user.role } });
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email already exists');
      throw error;
    }
  }
  async update(id: string, dto: UpdateUserDto, actor: RequestActor) {
    const existing = await this.get(id, actor);
    if (actor.role !== 'ADMIN' && dto.role && dto.role !== 'EMPLOYEE') throw new BadRequestException('Managers can assign employee role only');
    await this.validatePlacement(existing.organizationId!, dto.departmentId, dto.teamId);
    const user = await this.db.user.update({ where: { id }, data: dto, select: publicUser });
    await this.audit.record({ organizationId: existing.organizationId, actorId: actor.id, action: 'USER_UPDATED', targetType: 'User', targetId: id, result: 'SUCCESS', metadata: { fields: Object.keys(dto) } });
    return user;
  }
  private async validatePlacement(organizationId: string, departmentId?: string, teamId?: string) {
    if (departmentId && !(await this.db.department.findFirst({ where: { id: departmentId, organizationId } }))) throw new BadRequestException('Invalid department');
    if (teamId && !(await this.db.team.findFirst({ where: { id: teamId, organizationId } }))) throw new BadRequestException('Invalid team');
  }
}
