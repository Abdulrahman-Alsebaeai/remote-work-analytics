import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { RequestMetricsMiddleware } from './request-metrics.middleware';

@Module({ controllers: [MetricsController], providers: [MetricsService, RequestMetricsMiddleware], exports: [MetricsService] })
export class ObservabilityModule implements NestModule { configure(consumer: MiddlewareConsumer) { consumer.apply(RequestMetricsMiddleware).forRoutes('*'); } }
