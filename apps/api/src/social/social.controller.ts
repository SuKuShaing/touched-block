import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { type AuthUser, CurrentUser } from '../auth/auth.guard';
import { badRequest } from '../common/errors';
import { SocialService } from './social.service';

export class SetInviterDto {
  @IsString()
  @MaxLength(40)
  username: string;
}

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => badRequest('Identificador de usuario inválido.', 'invalid_user_id'),
});

@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Post('me/inviter')
  @HttpCode(200)
  setInviter(@CurrentUser() user: AuthUser, @Body() dto: SetInviterDto) {
    return this.social.setInviter(user.id, dto.username);
  }

  @Get('me/following')
  following(@CurrentUser() user: AuthUser) {
    return this.social.following(user.id);
  }

  @Get('me/followers')
  followers(@CurrentUser() user: AuthUser) {
    return this.social.followers(user.id);
  }

  @Post('follows/:userId')
  @HttpCode(204)
  async follow(@CurrentUser() user: AuthUser, @Param('userId', uuidPipe) targetId: string) {
    await this.social.follow(user.id, targetId);
  }

  @Delete('follows/:userId')
  @HttpCode(204)
  async unfollow(@CurrentUser() user: AuthUser, @Param('userId', uuidPipe) targetId: string) {
    await this.social.unfollow(user.id, targetId);
  }
}
