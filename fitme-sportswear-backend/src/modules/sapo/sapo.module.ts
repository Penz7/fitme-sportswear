import { Module } from '@nestjs/common';
import { SapoClient } from './sapo.client';
import { SapoSessionService } from './sapo-session.service';

@Module({
  providers: [SapoClient, SapoSessionService],
  exports: [SapoClient, SapoSessionService],
})
export class SapoModule {}
