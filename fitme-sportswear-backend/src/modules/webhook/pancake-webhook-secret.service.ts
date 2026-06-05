import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class PancakeWebhookSecretService {
  constructor(private readonly configService: ConfigService) {}

  verify(providedSecret: string | undefined): boolean {
    const expectedSecret = this.configService.get<string>('pancake.webhookSecret');

    if (!providedSecret || !expectedSecret) {
      return false;
    }

    const providedBuffer = Buffer.from(providedSecret);
    const expectedBuffer = Buffer.from(expectedSecret);

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
