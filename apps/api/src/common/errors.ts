import { HttpException, HttpStatus } from '@nestjs/common';

/** Cuerpo de error de la API: `{ statusCode, code, message, ...extra }`. `message` va en español. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  [k: string]: unknown;
}

export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ statusCode: status, code, message, ...extra } satisfies ApiErrorBody, status);
  }
}

export const unauthorized = (message = 'Debes iniciar sesión.', code = 'unauthorized') =>
  new ApiError(HttpStatus.UNAUTHORIZED, code, message);
export const forbidden = (message: string, code = 'forbidden') => new ApiError(HttpStatus.FORBIDDEN, code, message);
export const notFound = (message: string, code = 'not_found') => new ApiError(HttpStatus.NOT_FOUND, code, message);
export const badRequest = (message: string, code = 'bad_request', extra: Record<string, unknown> = {}) =>
  new ApiError(HttpStatus.BAD_REQUEST, code, message, extra);
export const conflict = (message: string, code = 'conflict', extra: Record<string, unknown> = {}) =>
  new ApiError(HttpStatus.CONFLICT, code, message, extra);
