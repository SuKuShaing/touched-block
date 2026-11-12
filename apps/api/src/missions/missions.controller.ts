import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { type AuthUser, CurrentUser } from '../auth/auth.guard';
import { utcDateKey } from '../common/dates';
import { MissionsService } from './missions.service';

export class MissionsQuery {
  /** Fecha local del jugador 'AAAA-MM-DD' (por defecto, la fecha UTC). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  date?: string;

  /** Minutos al este de UTC (el cliente manda `-new Date().getTimezoneOffset()`). Por defecto 0. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  tz?: number;
}

@Controller('missions')
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Get()
  get(@Query() q: MissionsQuery, @CurrentUser() user: AuthUser) {
    return this.missions.get(user.id, q.date ?? utcDateKey(new Date()), q.tz ?? 0);
  }
}
