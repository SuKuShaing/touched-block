import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MeDto } from '../users/dto';
import { UsersService } from '../users/users.service';
import { type TokenPair, TokensService } from './tokens.service';
import type { VerifiedIdentity } from './verifiers';

export type Provider = 'google' | 'apple';

export interface LoginResponse extends TokenPair {
  /** true si la cuenta se creó en este inicio de sesión (el cliente puede ofrecer cambiar el nombre). */
  isNew: boolean;
  user: MeDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokensService,
  ) {}

  /** Busca o crea el usuario de una identidad ya verificada y emite la sesión. */
  async login(provider: Provider, identity: VerifiedIdentity, opts: { country?: string; name?: string | null } = {}) {
    let isNew = false;
    let userId = await this.findUserId(provider, identity.subject);
    if (!userId) {
      try {
        const user = await this.users.createWithIdentity({
          provider,
          subject: identity.subject,
          email: identity.email,
          name: identity.name ?? opts.name ?? null,
          country: opts.country,
        });
        userId = user.id;
        isNew = true;
      } catch (e) {
        // dos inicios de sesión simultáneos de la misma cuenta: el otro ya la creó
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
        userId = await this.findUserId(provider, identity.subject);
        if (!userId) throw e;
      }
    }
    const tokens = await this.tokens.issue(userId);
    return { ...tokens, isNew, user: await this.users.getMe(userId) } satisfies LoginResponse;
  }

  async refresh(refreshToken: string) {
    const { userId, tokens } = await this.tokens.rotate(refreshToken);
    return { ...tokens, isNew: false, user: await this.users.getMe(userId) } satisfies LoginResponse;
  }

  logout(refreshToken: string) {
    return this.tokens.revoke(refreshToken);
  }

  private async findUserId(provider: Provider, subject: string): Promise<string | null> {
    const ident = await this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider, subject } },
      select: { userId: true },
    });
    return ident?.userId ?? null;
  }
}
