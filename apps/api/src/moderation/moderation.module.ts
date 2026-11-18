import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

/** Reportar, bloquear y la herramienta de moderación del dueño (guía 1.2 de Apple). */
@Module({
  imports: [UsersModule],
  controllers: [ModerationController, AdminController],
  providers: [ModerationService, AdminGuard],
})
export class ModerationModule {}
