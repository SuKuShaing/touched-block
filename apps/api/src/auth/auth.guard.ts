import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { unauthorized } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';

export interface AuthUser {
  id: string;
}

type AuthedRequest = Request & { user?: AuthUser };

const OPTIONAL_AUTH = 'tb:optionalAuth';
const PUBLIC = 'tb:public';

/** La ruta funciona sin sesión; si viene `Authorization`, debe ser válido. */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH, true);
/** La ruta no mira la sesión. */
export const Public = () => SetMetadata(PUBLIC, true);

/** Usuario autenticado (undefined en rutas con @OptionalAuth sin sesión). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

/**
 * Guard global: por defecto toda ruta exige `Authorization: Bearer <accessToken>`.
 * Se relaja con @Public() o @OptionalAuth().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, targets);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header) {
      if (optional) return true;
      throw unauthorized();
    }
    const m = /^Bearer\s+(.+)$/i.exec(header);
    const userId = m ? await this.tokens.verifyAccess(m[1].trim()) : null;
    if (!userId) throw unauthorized('Tu sesión expiró.', 'invalid_access_token');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw unauthorized('Tu cuenta ya no existe.', 'invalid_access_token');
    req.user = { id: user.id };
    return true;
  }
}
