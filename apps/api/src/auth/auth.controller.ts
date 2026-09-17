import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto';
import { Throttle } from '@nestjs/throttler';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } }) login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @Post('refresh') @HttpCode(200) @Throttle({ default: { limit: 30, ttl: 60_000 } }) refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }
  @Post('logout') @HttpCode(204) async logout(@Body() dto: RefreshDto) { await this.auth.logout(dto.refreshToken); }
  @Get('me') @UseGuards(AuthGuard('jwt')) me(@Req() request: { user: unknown }) { return request.user; }
}
