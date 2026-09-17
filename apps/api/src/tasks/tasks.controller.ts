import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles';
import { AddTaskNoteDto, CreateTaskDto, UpdateProgressDto, UpdateTaskDto } from './dto';
import { TaskActor, TasksService } from './tasks.service';
@Controller('tasks') @UseGuards(AuthGuard('jwt'), RolesGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get() list(@Req() req: { user: TaskActor }) { return this.tasks.list(req.user); }
  @Post() create(@Body() dto: CreateTaskDto, @Req() req: { user: TaskActor }) { return this.tasks.create(dto, req.user); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @Req() req: { user: TaskActor }) { return this.tasks.update(id, dto, req.user); }
  @Patch(':id/progress') progress(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgressDto, @Req() req: { user: TaskActor }) { return this.tasks.updateProgress(id, dto, req.user); }
  @Post(':id/notes') note(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddTaskNoteDto, @Req() req: { user: TaskActor }) { return this.tasks.addNote(id, dto, req.user); }
  @Delete(':id') @HttpCode(204) async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: TaskActor }) { await this.tasks.remove(id, req.user); }
}
