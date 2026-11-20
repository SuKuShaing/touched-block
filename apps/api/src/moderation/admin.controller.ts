import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/auth.guard';
import { badRequest } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { deleteUserByModeration, findUserByUsername, forceRename, listReports, resolveReport } from './admin';
import { AdminGuard } from './admin.guard';
import { AdminRenameDto, AdminReportsQuery, AdminResolveDto } from './dto';

const uuidPipe = new ParseUUIDPipe({ exceptionFactory: () => badRequest('Identificador inválido.', 'invalid_id') });

/**
 * Herramienta de moderación del dueño (guía 1.2 de Apple). Protegida con ADMIN_TOKEN en la
 * cabecera `X-Admin-Token`; sin la variable, 404. Equivalente en línea de comandos:
 * scripts/moderation.mjs (docs/despliegue.md, "Moderación").
 */
@Controller('admin')
@Public()
@UseGuards(AdminGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get('reports')
  reports(@Query() q: AdminReportsQuery) {
    return listReports(this.prisma, { status: q.status, limit: q.limit });
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  async resolve(@Param('id', uuidPipe) id: string, @Body() dto: AdminResolveDto) {
    const r = await resolveReport(this.prisma, id, dto);
    return { id: r.id, status: r.status, resolution: r.resolution, resolvedAt: r.resolvedAt?.toISOString() ?? null };
  }

  @Post('users/:username/rename')
  @HttpCode(200)
  rename(@Param('username') username: string, @Body() dto: AdminRenameDto) {
    return forceRename(this.prisma, username, dto.username);
  }

  /** Elimina la cuenta (igual que DELETE /me, con la revocación de Apple) y cierra sus reportes. */
  @Delete('users/:username')
  @HttpCode(200)
  async remove(@Param('username') username: string) {
    const user = await findUserByUsername(this.prisma, username);
    const resolvedReports = await deleteUserByModeration(this.prisma, user, (id) => this.users.deleteMe(id));
    return { deleted: user.username, resolvedReports };
  }
}
