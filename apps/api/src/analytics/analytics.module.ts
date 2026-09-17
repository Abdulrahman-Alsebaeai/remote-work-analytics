import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaService } from '../infrastructure/prisma.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ReportsService } from './reports.service';

@Module({ imports: [AuditModule], controllers: [AnalyticsController], providers: [AnalyticsService, ReportsService, PrismaService], exports: [AnalyticsService] })
export class AnalyticsModule {}
