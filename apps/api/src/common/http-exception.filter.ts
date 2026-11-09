import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

const DEFAULTS: Record<number, [code: string, message: string]> = {
  400: ['bad_request', 'Solicitud inválida.'],
  401: ['unauthorized', 'Debes iniciar sesión.'],
  403: ['forbidden', 'No tienes permiso para hacer esto.'],
  404: ['not_found', 'No encontrado.'],
  409: ['conflict', 'Conflicto con el estado actual.'],
  413: ['payload_too_large', 'La solicitud es demasiado grande.'],
  429: ['too_many_requests', 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'],
  500: ['internal_error', 'Error interno del servidor.'],
  503: ['unavailable', 'Servicio no disponible.'],
};

/** Normaliza todos los errores a `{ statusCode, code, message, ... }` con mensajes en español. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (r && typeof r === 'object' && typeof (r as { code?: unknown }).code === 'string') {
        body = r as Record<string, unknown>;
      }
    } else if (isBodyParserError(exception)) {
      status = exception.status;
    } else {
      this.log.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    if (!body) {
      const [code, message] = DEFAULTS[status] ?? DEFAULTS[status >= 500 ? 500 : 400];
      body = { statusCode: status, code, message };
    }
    res.status(status).json(body);
  }
}

function isBodyParserError(e: unknown): e is { status: number; type: string } {
  return !!e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number' && typeof (e as { type?: unknown }).type === 'string';
}
