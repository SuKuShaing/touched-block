import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { type AuthUser, CurrentUser, OptionalAuth } from '../auth/auth.guard';
import { LeaderboardsService, SCOPES, type Scope } from './leaderboards.service';
import { PERIODS, type Period } from './periods';

export class LeaderboardQuery {
  @IsOptional()
  @IsIn(SCOPES)
  scope?: Scope;

  @IsOptional()
  @IsIn(PERIODS)
  period?: Period;

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

@Controller('leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboards: LeaderboardsService) {}

  @Get()
  @OptionalAuth()
  get(@Query() q: LeaderboardQuery, @CurrentUser() user?: AuthUser) {
    return this.leaderboards.get({
      scope: q.scope ?? 'world',
      period: q.period ?? 'all',
      country: q.country,
      limit: q.limit ?? 50,
      userId: user?.id,
    });
  }
}
