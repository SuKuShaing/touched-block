import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig } from './config/app-config';

async function bootstrap() {
  try {
    process.loadEnvFile('.env');
  } catch {
    // sin .env: las variables vienen del entorno
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  configureApp(app);
  const { port } = app.get(AppConfig);
  await app.listen(port, '0.0.0.0');
  new Logger('API').log(`Escuchando en el puerto ${port}`);
}

void bootstrap();
