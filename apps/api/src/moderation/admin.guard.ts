import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { notFound } from '../common/errors';
import { AppConfig } from '../config/app-config';

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/**
 * Compara dos secretos en tiempo constante: se comparan sus sha256 (siempre 32 bytes), así que
 * ni el largo ni el contenido del token se filtran por el tiempo de respuesta.
 */
export function sameSecret(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Endpoints /admin/*: exigen la cabecera `X-Admin-Token` igual a ADMIN_TOKEN. Si la variable no
 * existe o el token no coincide, responden 404 (como si la ruta no existiera).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(ctx: ExecutionContext): boolean {
    const expected = this.config.adminToken;
    const given = ctx.switchToHttp().getRequest<Request>().headers['x-admin-token'];
    if (!expected || typeof given !== 'string' || !given || !sameSecret(given, expected)) {
      throw notFound('No encontrado.', 'not_found');
    }
    return true;
  }
}
