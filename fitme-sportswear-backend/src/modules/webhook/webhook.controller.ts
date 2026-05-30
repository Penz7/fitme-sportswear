import { Controller, Get } from '@nestjs/common';

@Controller('webhooks')
export class WebhookController {
  @Get('internal/status')
  getStatus() {
    return {
      status: 'not-configured',
      message: 'Real platform webhook handling is intentionally out of scope for phase one.',
    };
  }
}
