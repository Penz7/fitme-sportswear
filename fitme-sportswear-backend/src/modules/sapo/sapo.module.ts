import { Module } from '@nestjs/common';
import { SapoClient } from './sapo.client';

@Module({
  providers: [SapoClient],
  exports: [SapoClient],
})
export class SapoModule {}
