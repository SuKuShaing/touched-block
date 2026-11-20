import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MeDto } from '../users/dto';
import { UsersService } from '../users/users.service';
import { type TokenPair, TokensService } from './tokens.service';
import type { VerifiedIdentity } from './verifiers';
import { truncateChars } from '../common/text';

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

  /**
   * Busca o crea el usuario de una identidad ya verificada y emite la sesión.
   * `opts.name`: nombre que manda el cliente (Sign in with Apple lo entrega solo en el primer inicio de
   * sesión). Se usa al crear la cuenta. En una cuenta que ya existe nunca reemplaza ni borra el nombre:
   * solo lo completa si estaba vacío (p. ej. el primer intento creó la cuenta pero la respuesta no llegó
   * y el cliente reintentó con el nombre que tenía en memoria).
   */
  async login(provider: Provider, identity: VerifiedIdentity, opts: { country?: string; name?: string | null } = {}) {
    let isNew = false;
    const name = truncateChars((identity.name ?? opts.name)?.trim() ?? '', 100).trim() || null;
    let userId = await this.findUserId(provider, identity.subject);
    // solo con el nombre que manda el cliente (Apple), no con el del token de Google, que llega siempre
    const clientName = truncateChars(opts.name?.trim() ?? '', 100).trim() || null;
    if (userId && clientName) {
      await this.prisma.user.updateMany({ where: { id: userId, displayName: null }, data: { displayName: clientName } });
    }
    if (!userId) {
      try {
        const user = await this.users.createWithIdentity({
          provider,
          subject: identity.subject,
          email: identity.email,
          name,
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
