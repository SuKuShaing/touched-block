import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { type AuthUser, CurrentUser, OptionalAuth } from '../auth/auth.guard';
import { hasDateStarted, isWithinDateWindow, utcDateKey } from '../common/dates';
import { SCOPES, type Scope } from '../leaderboards/scope';
import { DailyService, dailyDateInvalid } from './daily.service';

export class DailyQuery {
  /** Fecha local del jugador 'AAAA-MM-DD' (por defecto, la fecha UTC). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  date?: string;
}

export class DailyLeaderboardQuery extends DailyQuery {
  @IsOptional()
  @IsIn(SCOPES)
  scope?: Scope;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller('daily')
export class DailyController {
  constructor(private readonly daily: DailyService) {}

  @Get()
  @OptionalAuth()
  overview(@Query() q: DailyQuery, @CurrentUser() user?: AuthUser) {
    const date = q.date ?? utcDateKey(new Date());
    if (!isWithinDateWindow(date)) throw dailyDateInvalid();
    return this.daily.overview(date, user?.id);
  }

  @Get('leaderboard')
  @OptionalAuth()
  leaderboard(@Query() q: DailyLeaderboardQuery, @CurrentUser() user?: AuthUser) {
    const date = q.date ?? utcDateKey(new Date());
    // las fechas pasadas también; no las que todavía no empezaron en ninguna zona horaria
    if (!hasDateStarted(date)) throw dailyDateInvalid();
    return this.daily.leaderboard({
      date,
      scope: q.scope ?? 'world',
      country: q.country,
      limit: q.limit ?? 50,
      userId: user?.id,
    });
  }
}
