import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { PrismaService } from './infrastructure/prisma.service';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AgentSyncModule } from './agent-sync/agent-sync.module';
import { ScreenshotsModule } from './screenshots/screenshots.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';
import { validateEnvironment } from './config/environment';
import { ObservabilityModule } from './observability/observability.module';
import { SettingsModule } from './settings/settings.module';
import { ActivitiesModule } from './activities/activities.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'], validate: validateEnvironment }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), ObservabilityModule, AuditModule, AuthModule, UsersModule, TasksModule, NotificationsModule, AgentSyncModule, ScreenshotsModule, ActivitiesModule, AnalyticsModule, AiModule, SettingsModule],
  controllers: [HealthController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
  exports: [PrismaService],
})
export class AppModule {}
