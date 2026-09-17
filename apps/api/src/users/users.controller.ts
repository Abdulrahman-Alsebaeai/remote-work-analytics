import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles';
import { CreateUserDto, UpdateUserDto } from './dto';
import { RequestActor, UsersService } from './users.service';
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() list(@Req() req: { user: RequestActor }) { return this.users.list(req.user); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: RequestActor }) { return this.users.get(id, req.user); }
  @Post() create(@Body() dto: CreateUserDto, @Req() req: { user: RequestActor }) { return this.users.create(dto, req.user); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @Req() req: { user: RequestActor }) { return this.users.update(id, dto, req.user); }
}
