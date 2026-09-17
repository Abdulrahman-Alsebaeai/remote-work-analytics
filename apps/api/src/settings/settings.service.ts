import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../infrastructure/prisma.service';
import { TaskActor } from '../tasks/tasks.service';
import { UpdateSettingsDto, supportedFonts, supportedTypographyScales } from './dto';

@Injectable()
export class SettingsService {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  async get(actor: TaskActor) {
    if (!actor.organizationId) throw new ForbiddenException('Organization membership required');
    const settings = await this.db.organizationSettings.upsert({
      where: { organizationId: actor.organizationId }, update: {}, create: { organizationId: actor.organizationId },
    });
    return { ...settings, supportedFonts, supportedTypographyScales };
  }

  async update(dto: UpdateSettingsDto, actor: TaskActor) {
    if (!actor.organizationId || actor.role !== 'ADMIN') throw new ForbiddenException('Administrator access required');
    if (!dto.fontKey && !dto.typographyScale && dto.screenshotIntervalSeconds === undefined) throw new BadRequestException('At least one organization setting is required');
    const changes = {
      ...(dto.fontKey ? { fontKey: dto.fontKey } : {}),
      ...(dto.typographyScale ? { typographyScale: dto.typographyScale } : {}),
      ...(dto.screenshotIntervalSeconds !== undefined ? { screenshotIntervalSeconds: dto.screenshotIntervalSeconds } : {}),
    };
    const settings = await this.db.organizationSettings.upsert({
      where: { organizationId: actor.organizationId },
      update: changes,
      create: { organizationId: actor.organizationId, ...changes },
    });
    await this.audit.record({ organizationId: actor.organizationId, actorId: actor.id, action: 'ORGANIZATION_SETTINGS_UPDATED', targetType: 'OrganizationSettings', targetId: actor.organizationId, result: 'SUCCESS', metadata: changes });
    return { ...settings, supportedFonts, supportedTypographyScales };
  }
}
