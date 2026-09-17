import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './infrastructure/prisma.service';
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() check() { return this.live(); }
  @Get('live') live() { return { status: 'ok', timestamp: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) }; }
  @Get('ready') async ready() { try { await this.db.$queryRaw`SELECT 1`; return { status: 'ready', timestamp: new Date().toISOString() }; } catch { throw new ServiceUnavailableException('Database is not ready'); } }
}
