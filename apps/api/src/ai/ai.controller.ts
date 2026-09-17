import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles';
import { TaskActor } from '../tasks/tasks.service';
import { AiService } from './ai.service';
import { CreateAiAnalysisDto } from './dto';

@Controller('ai/analyses') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN', 'MANAGER')
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Post() create(@Body() dto: CreateAiAnalysisDto, @Req() req: { user: TaskActor }) { return this.ai.create(dto, req.user); }
  @Get() list(@Req() req: { user: TaskActor }) { return this.ai.list(req.user); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: TaskActor }) { return this.ai.get(id, req.user); }
}
