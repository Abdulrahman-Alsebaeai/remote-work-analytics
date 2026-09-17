import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../infrastructure/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles';
import { AuditService } from '../audit/audit.service';
@Module({
  imports: [PassportModule, JwtModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService): JwtModuleOptions => ({
      secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_TTL') ?? '15m') as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'] },
    }),
  })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, PrismaService, AuditService],
  exports: [AuthService, RolesGuard],
})
export class AuthModule {}
