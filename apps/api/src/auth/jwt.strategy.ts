import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: PrismaService, config: ConfigService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET') });
  }
  async validate(payload: { sub: string }) {
    const user = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, displayName: true, role: true, status: true, locale: true, organizationId: true } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();
    return user;
  }
}
