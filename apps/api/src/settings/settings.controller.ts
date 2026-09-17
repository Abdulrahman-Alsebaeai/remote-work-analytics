import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TaskActor } from '../tasks/tasks.service';
import { UpdateSettingsDto } from './dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AuthGuard('jwt'))
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}
  @Get() get(@Req() req: { user: TaskActor }) { return this.settings.get(req.user); }
  @Patch() update(@Body() dto: UpdateSettingsDto, @Req() req: { user: TaskActor }) { return this.settings.update(dto, req.user); }
}
