import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TaskActor } from '../tasks/tasks.service';
import { NotificationsService } from './notifications.service';
@Controller('notifications') @UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@Req() req: { user: TaskActor }) { return this.notifications.list(req.user); }
  @Patch(':id/read') @HttpCode(204) async read(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: TaskActor }) { await this.notifications.markRead(id, req.user); }
}
