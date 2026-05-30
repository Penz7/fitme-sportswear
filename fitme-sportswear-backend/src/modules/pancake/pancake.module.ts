import { Module } from '@nestjs/common';
import { PancakeClient } from './pancake.client';

@Module({
  providers: [PancakeClient],
  exports: [PancakeClient],
})
export class PancakeModule {}
