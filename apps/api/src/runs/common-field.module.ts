import { Module } from '@nestjs/common';
import { CommonFieldService } from './common-field.service';

@Module({
  providers: [CommonFieldService],
  exports: [CommonFieldService],
})
export class CommonFieldModule {}
