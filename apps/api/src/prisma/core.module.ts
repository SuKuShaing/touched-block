import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [AppConfig, PrismaService],
  exports: [AppConfig, PrismaService],
})
export class CoreModule {}
