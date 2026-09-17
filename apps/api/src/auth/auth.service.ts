import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(private readonly db: PrismaService, private readonly jwt: JwtService, private readonly audit: AuditService) {}

  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.status !== 'ACTIVE' || !(await argon2.verify(user.passwordHash, password))) {
      await this.audit.record({ organizationId: user?.organizationId, actorId: user?.id, action: 'AUTH_LOGIN', targetType: 'User', targetId: user?.id, result: 'FAILURE' });
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.audit.record({ organizationId: user.organizationId, actorId: user.id, action: 'AUTH_LOGIN', targetType: 'User', targetId: user.id, result: 'SUCCESS' });
    return tokens;
  }

  async refresh(rawToken: string) {
    const hash = this.hash(rawToken);
    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash: hash }, include: { user: true } });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || stored.user.status !== 'ACTIVE')
        throw new UnauthorizedException('Invalid refresh token');
      await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
      return this.issueTokens(stored.user.id, stored.user.email, stored.user.role, tx);
    });
  }

  async logout(rawToken: string) {
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash: this.hash(rawToken) }, include: { user: true } });
    await this.db.refreshToken.updateMany({ where: { tokenHash: this.hash(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
    if (stored) await this.audit.record({ organizationId: stored.user.organizationId, actorId: stored.userId, action: 'AUTH_LOGOUT', targetType: 'User', targetId: stored.userId, result: 'SUCCESS' });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: string,
    db: Prisma.TransactionClient | PrismaService = this.db,
  ) {
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
    await db.refreshToken.create({ data: { tokenHash: this.hash(refreshToken), userId, expiresAt: new Date(Date.now() + days * 86400000) } });
    const accessToken = await this.jwt.signAsync({ sub: userId, email, role });
    return { accessToken, refreshToken, expiresInSeconds: 900 };
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
