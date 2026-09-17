import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TaskActor } from '../tasks/tasks.service';
import { AgentSyncService } from './agent-sync.service';
import { SyncAgentEventsDto } from './dto';
@Controller('agent') @UseGuards(AuthGuard('jwt'))
export class AgentSyncController {
  constructor(private readonly sync: AgentSyncService) {}
  @Post('sync') synchronize(@Body() dto: SyncAgentEventsDto, @Req() req: { user: TaskActor }) { return this.sync.synchronize(dto.events, req.user); }
}
