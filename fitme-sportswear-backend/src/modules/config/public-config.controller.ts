import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TEST_SYNC_QUEUE } from '../queue/queue.constants';

@Controller('config')
export class PublicConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('public')
  getPublicConfig() {
    return {
      environment: this.configService.getOrThrow<string>('app.env'),
      version: this.configService.getOrThrow<string>('app.version'),
      queues: [TEST_SYNC_QUEUE],
      platforms: ['sapo', 'pancake', 'shopify'],
    };
  }
}
