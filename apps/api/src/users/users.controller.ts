import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, CurrentUser, OptionalAuth } from '../auth/auth.guard';
import { CheckUsernameQuery, SearchUsersQuery, UpdateMeDto } from './dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Delete('me')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser) {
    await this.users.deleteMe(user.id);
  }

  // Las rutas fijas van antes de /users/:username.
  @Get('users/check-username')
  @OptionalAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  check(@Query() q: CheckUsernameQuery, @CurrentUser() user?: AuthUser) {
    return this.users.checkUsername(q.u, user?.id);
  }

  @Get('users/search')
  @OptionalAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async search(@Query() q: SearchUsersQuery, @CurrentUser() user?: AuthUser) {
    return { users: await this.users.search(q.q, user?.id) };
  }

  @Get('users/:username')
  @OptionalAuth()
  profile(@Param('username') username: string, @CurrentUser() user?: AuthUser) {
    return this.users.publicProfile(username, user?.id);
  }
}
