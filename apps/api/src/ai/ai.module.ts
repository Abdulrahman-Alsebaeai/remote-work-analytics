import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../auth/roles';
import { PrismaService } from '../infrastructure/prisma.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { StatisticalInsightGenerator, WeightedActivityClassifier } from './local-ai.adapter';
import { ACTIVITY_CLASSIFIER, INSIGHT_GENERATOR } from './ports';

@Module({ imports: [AnalyticsModule, AuditModule], controllers: [AiController], providers: [AiService, PrismaService, RolesGuard, { provide: ACTIVITY_CLASSIFIER, useClass: WeightedActivityClassifier }, { provide: INSIGHT_GENERATOR, useClass: StatisticalInsightGenerator }] })
export class AiModule {}
