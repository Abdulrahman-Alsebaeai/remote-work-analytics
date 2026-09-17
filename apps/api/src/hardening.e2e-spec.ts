import { Controller, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';
import request from 'supertest';
import { HealthController } from './health.controller';
import { PrismaService } from './infrastructure/prisma.service';
import { ObservabilityModule } from './observability/observability.module';

@Controller('limited')
class LimitedController { @Post() @Throttle({ default: { limit: 3, ttl: 60_000 } }) execute() { return { accepted: true }; } }

describe('operational hardening (e2e)', () => {
  let app: INestApplication; const previousToken = process.env.METRICS_TOKEN;
  beforeAll(async () => {
    process.env.METRICS_TOKEN = 'e2e-metrics-token-value-1234';
    const module = await Test.createTestingModule({ imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), ObservabilityModule], controllers: [HealthController, LimitedController], providers: [{ provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]) } }, { provide: APP_GUARD, useClass: ThrottlerGuard }] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); app.use(helmet()); app.enableShutdownHooks(); await app.init();
  });
  afterAll(async () => { if (previousToken === undefined) delete process.env.METRICS_TOKEN; else process.env.METRICS_TOKEN = previousToken; await app.close(); });

  it('serves liveness with security and correlation headers', async () => { const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200); expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/); expect(response.headers['x-content-type-options']).toBe('nosniff'); expect(response.body.status).toBe('ok'); });
  it('checks database readiness', async () => { await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200).expect(({ body }) => expect(body.status).toBe('ready')); });
  it('protects metrics and exposes Prometheus text to its bearer token', async () => { await request(app.getHttpServer()).get('/api/v1/metrics').expect(401); const response = await request(app.getHttpServer()).get('/api/v1/metrics').set('authorization', `Bearer ${process.env.METRICS_TOKEN}`).expect(200); expect(response.text).toContain('remote_work_http_requests_total'); });
  it('rate limits abusive clients', async () => { for (let index = 0; index < 3; index += 1) await request(app.getHttpServer()).post('/api/v1/limited').expect(201); await request(app.getHttpServer()).post('/api/v1/limited').expect(429); });
});
