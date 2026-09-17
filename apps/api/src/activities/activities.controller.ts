import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TaskActor } from '../tasks/tasks.service';
import { ActivitiesService } from './activities.service';
import { ListActivitiesQueryDto } from './dto';

@Controller('activities')
@UseGuards(AuthGuard('jwt'))
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}
  @Get() list(@Query() query: ListActivitiesQueryDto, @Req() req: { user: TaskActor }) { return this.activities.list(req.user, query); }
}
