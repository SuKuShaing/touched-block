import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser, OptionalAuth } from '../auth/auth.guard';
import { notFound } from '../common/errors';
import { ClaimRunDto, CreateRunDto, FinishRunDto, MyRunsQuery } from './dto';
import { RunsService } from './runs.service';

const runIdPipe = new ParseUUIDPipe({ exceptionFactory: () => notFound('Partida no encontrada.', 'run_not_found') });

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('runs')
  @OptionalAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@Body() dto: CreateRunDto, @CurrentUser() user?: AuthUser) {
    return this.runs.create(user?.id, dto);
  }

  @Post('runs/:id/finish')
  @HttpCode(200)
  @OptionalAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  finish(@Param('id', runIdPipe) id: string, @Body() dto: FinishRunDto, @CurrentUser() user?: AuthUser) {
    return this.runs.finish(id, user?.id, dto);
  }

  @Post('runs/:id/claim')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  claim(@Param('id', runIdPipe) id: string, @Body() dto: ClaimRunDto, @CurrentUser() user: AuthUser) {
    return this.runs.claim(id, user.id, dto);
  }

  @Get('me/runs')
  history(@Query() q: MyRunsQuery, @CurrentUser() user: AuthUser) {
    return this.runs.history(user.id, q.period ?? 'all', q.limit ?? 50);
  }
}
