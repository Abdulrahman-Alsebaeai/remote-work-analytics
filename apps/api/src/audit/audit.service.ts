import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma.service';

export interface AuditEvent {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  result: 'SUCCESS' | 'FAILURE';
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}
  async record(event: AuditEvent): Promise<void> {
    await this.db.auditLog.create({ data: event });
  }
}
