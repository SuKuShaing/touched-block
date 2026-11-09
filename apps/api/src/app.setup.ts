import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { AppConfig } from './config/app-config';

function flatten(errors: ValidationError[], parent = ''): { field: string; problems: string[] }[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? [{ field, problems: Object.keys(e.constraints) }] : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Configuración común a main.ts y a los tests e2e. */
export function configureApp(app: INestApplication) {
  const config = app.get(AppConfig);
  const express = app as NestExpressApplication;
  express.set('trust proxy', config.trustProxy);
  express.disable('x-powered-by');
  // las partidas largas mandan muchos toques
  express.useBodyParser('json', { limit: '1mb' });
  app.enableCors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          code: 'validation_error',
          message: 'Datos inválidos.',
          fields: flatten(errors),
        }),
    }),
  );
  app.enableShutdownHooks();
  return app;
}
