import { Controller, Get, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RULES_VERSION } from '@tb/engine';
import { Public } from '../auth/auth.guard';
import { ApiError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';

const VERSION = process.env.APP_VERSION ?? 'dev';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, 'db_unavailable', 'La base de datos no responde.');
    }
    return { status: 'ok', db: 'ok', rulesVersion: RULES_VERSION, version: VERSION, time: new Date().toISOString() };
  }
}
