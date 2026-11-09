import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomToken, sha256 } from '../common/crypto';
import { unauthorized } from '../common/errors';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  /** Segundos de validez del accessToken. */
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

const expired = () => unauthorized('Tu sesión expiró. Inicia sesión de nuevo.', 'invalid_refresh_token');

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async issue(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: userId }, { expiresIn: this.config.accessTokenTtlSec });
    const refreshToken = randomToken();
    const expiresAt = new Date(Date.now() + this.config.refreshTokenTtlDays * 86_400_000);
    await this.prisma.refreshToken.create({ data: { userId, hash: sha256(refreshToken), expiresAt } });
    return {
      accessToken,
      accessTokenExpiresIn: this.config.accessTokenTtlSec,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  /** Rota el refresh token: revoca el actual y emite un par nuevo. Cada refresh token sirve una sola vez. */
  async rotate(refreshToken: string): Promise<{ userId: string; tokens: TokenPair }> {
    const hash = sha256(refreshToken);
    const now = new Date();
    // revocación atómica: si dos peticiones usan el mismo token, solo una gana
    const res = await this.prisma.refreshToken.updateMany({
      where: { hash, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    if (res.count !== 1) throw expired();
    const row = await this.prisma.refreshToken.findUnique({ where: { hash }, select: { userId: true } });
    if (!row) throw expired();
    return { userId: row.userId, tokens: await this.issue(row.userId) };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { hash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Verifica un JWT de acceso y devuelve el id de usuario, o null si no es válido. */
  async verifyAccess(token: string): Promise<string | null> {
    try {
      const p = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      return typeof p.sub === 'string' ? p.sub : null;
    } catch {
      return null;
    }
  }
}
