import { ConfigService } from '@nestjs/config';
import { PancakeWebhookSecretService } from './pancake-webhook-secret.service';

describe('PancakeWebhookSecretService', () => {
  function createService(secret = 'pancake-secret') {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'pancake.webhookSecret' ? secret : undefined,
      ),
    } as unknown as ConfigService;

    return new PancakeWebhookSecretService(configService);
  }

  it('verifies a valid Pancake webhook secret', () => {
    expect(createService().verify('pancake-secret')).toBe(true);
  });

  it('rejects missing, invalid, or differently sized secrets', () => {
    const service = createService();

    expect(service.verify(undefined)).toBe(false);
    expect(service.verify('wrong-secret')).toBe(false);
    expect(service.verify('short')).toBe(false);
  });

  it('rejects requests when the expected secret is not configured', () => {
    expect(createService('').verify('pancake-secret')).toBe(false);
  });
});
