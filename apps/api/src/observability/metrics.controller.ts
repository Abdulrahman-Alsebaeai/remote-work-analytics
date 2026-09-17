import { Controller, Get, Headers, Res, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}
  @Get() read(@Headers('authorization') authorization: string | undefined, @Res() response: Response) { const token = process.env.METRICS_TOKEN; if (token && !this.matches(authorization, `Bearer ${token}`)) throw new UnauthorizedException(); response.type('text/plain; version=0.0.4; charset=utf-8').send(this.metrics.render()); }
  private matches(actual: string | undefined, expected: string) { if (!actual) return false; const left = Buffer.from(actual); const right = Buffer.from(expected); return left.length === right.length && timingSafeEqual(left, right); }
}
