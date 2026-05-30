import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class ShopifyHmacService {
  constructor(private readonly configService: ConfigService) {}

  verify(hmac: string | undefined, rawPayload: string): boolean {
    const secret = this.configService.get<string>('shopify.webhookSecret');

    if (!hmac || !secret) {
      return false;
    }

    const calculated = createHmac('sha256', secret)
      .update(rawPayload)
      .digest('base64');
    const actualBuffer = Buffer.from(hmac);
    const calculatedBuffer = Buffer.from(calculated);

    if (actualBuffer.length !== calculatedBuffer.length) {
      return false;
    }

    return timingSafeEqual(actualBuffer, calculatedBuffer);
  }
}
