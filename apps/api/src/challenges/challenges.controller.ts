import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { type AuthUser, CurrentUser, OptionalAuth } from '../auth/auth.guard';
import { ChallengesService } from './challenges.service';

export class ChallengeQuery {
  /** Partida propia (útil para invitados): marca `isMe` en su resultado. */
  @IsOptional()
  @IsUUID()
  runId?: string;
}

@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get(':code')
  @OptionalAuth()
  get(@Param('code') code: string, @Query() q: ChallengeQuery, @CurrentUser() user?: AuthUser) {
    return this.challenges.view(code, { userId: user?.id, runId: q.runId });
  }
}
