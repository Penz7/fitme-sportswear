import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ShopifyHmacService } from './shopify-hmac.service';

describe('ShopifyHmacService', () => {
  function createService(secret = 'webhook-secret') {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'shopify.webhookSecret' ? secret : undefined,
      ),
    } as unknown as ConfigService;

    return new ShopifyHmacService(configService);
  }

  it('verifies a valid Shopify HMAC signature', () => {
    const payload = '{"id":12345}';
    const signature = createHmac('sha256', 'webhook-secret')
      .update(payload)
      .digest('base64');

    expect(createService().verify(signature, payload)).toBe(true);
  });

  it('rejects an invalid Shopify HMAC signature', () => {
    expect(createService().verify('invalid', '{"id":12345}')).toBe(false);
  });

  it('rejects missing signature or missing secret', () => {
    expect(createService().verify(undefined, '{"id":12345}')).toBe(false);
    expect(createService('').verify('anything', '{"id":12345}')).toBe(false);
  });
});
