import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { MetricsService } from './metrics.service';

@Injectable()
export class RequestMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}
  use(request: Request, response: Response, next: NextFunction) { const supplied = request.header('x-request-id'); const requestId = supplied && /^[a-zA-Z0-9._-]{8,100}$/.test(supplied) ? supplied : randomUUID(); response.setHeader('x-request-id', requestId); const started = process.hrtime.bigint(); response.on('finish', () => { const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000; const route = request.originalUrl.split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/[^a-zA-Z0-9/_:.-]/g, '_'); this.metrics.observe(request.method, route, response.statusCode, durationMs / 1000); process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event: 'http_request', requestId, method: request.method, route, status: response.statusCode, durationMs: Number(durationMs.toFixed(2)), ip: request.ip })}\n`); }); next(); }
}
