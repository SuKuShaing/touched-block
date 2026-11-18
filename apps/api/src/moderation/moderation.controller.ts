import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser } from '../auth/auth.guard';
import { ReportDto } from './dto';
import { ModerationService } from './moderation.service';

/** Reportar y bloquear jugadores. Todas requieren sesión. */
@Controller()
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('users/:username/report')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  report(@CurrentUser() user: AuthUser, @Param('username') username: string, @Body() dto: ReportDto) {
    return this.moderation.report(user.id, username, dto);
  }

  @Post('users/:username/block')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async block(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    await this.moderation.block(user.id, username);
  }

  @Delete('users/:username/block')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async unblock(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    await this.moderation.unblock(user.id, username);
  }

  @Get('me/blocks')
  blocks(@CurrentUser() user: AuthUser) {
    return this.moderation.blocks(user.id);
  }
}
