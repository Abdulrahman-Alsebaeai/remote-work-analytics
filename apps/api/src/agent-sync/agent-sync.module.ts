import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma.service';
import { AgentSyncController } from './agent-sync.controller';
import { AgentSyncService } from './agent-sync.service';
@Module({ controllers: [AgentSyncController], providers: [AgentSyncService, PrismaService] })
export class AgentSyncModule {}
