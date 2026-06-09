import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  function createController(options: { pancakeSecretValid?: boolean; shopifyHmacValid?: boolean; webhookEnabled?: boolean; platformEnabled?: boolean } = {}) {
    const ingestionService = {
      ingestPancake: jest.fn().mockResolvedValue({ id: 'pancake-event' }),
      ingestShopify: jest.fn().mockResolvedValue({ id: 'shopify-event' }),
    };
    const shopifyHmacService = {
      verify: jest.fn().mockReturnValue(options.shopifyHmacValid ?? true),
    };
    const pancakeWebhookSecretService = {
      verify: jest.fn().mockReturnValue(options.pancakeSecretValid ?? true),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'webhook.ingestionEnabled') {
          return options.webhookEnabled ?? true;
        }
        if (key === 'webhook.pancake.enabled' || key === 'webhook.shopify.enabled') {
          return options.platformEnabled ?? true;
        }
        return undefined;
      }),
    };
    return {
      controller: new WebhookController(
        ingestionService as any,
        shopifyHmacService as any,
        pancakeWebhookSecretService as any,
        configService as any,
      ),
      ingestionService,
      shopifyHmacService,
      pancakeWebhookSecretService,
    };
  }

  const request = { rawBody: Buffer.from('{"id":"order-1"}') } as any;

  it('rejects Pancake webhooks with invalid secret', () => {
    const { controller } = createController({ pancakeSecretValid: false });

    expect(() =>
      controller.ingestPancakeWebhook({ id: 'order-1' }, request, 'wrong'),
    ).toThrow(UnauthorizedException);
  });

  it('does not enqueue Pancake webhooks when ingestion is disabled', async () => {
    const { controller, ingestionService } = createController({ webhookEnabled: false });

    expect(
      controller.ingestPancakeWebhook({ id: 'order-1' }, request, 'secret'),
    ).toMatchObject({
      platform: 'pancake',
      status: 'ignored',
      reason: 'WEBHOOK_INGESTION_DISABLED',
    });
    expect(ingestionService.ingestPancake).not.toHaveBeenCalled();
  });

  it('enqueues Pancake webhooks when secret and switches are valid', async () => {
    const { controller, ingestionService } = createController();

    await controller.ingestPancakeWebhook({ id: 'order-1' }, request, 'secret');

    expect(ingestionService.ingestPancake).toHaveBeenCalledWith('{"id":"order-1"}');
  });

  it('accepts Pancake webhook secret from query when header is unavailable', async () => {
    const { controller, pancakeWebhookSecretService } = createController();

    await controller.ingestPancakeWebhook(
      { id: 'order-1' },
      request,
      undefined,
      'query-secret',
    );

    expect(pancakeWebhookSecretService.verify).toHaveBeenCalledWith('query-secret');
  });

  it('rejects Shopify webhooks with invalid HMAC', () => {
    const { controller } = createController({ shopifyHmacValid: false });

    expect(() =>
      controller.ingestShopifyOrderWebhook({ id: 123 }, request, 'bad-hmac'),
    ).toThrow(UnauthorizedException);
  });

  it('does not enqueue Shopify webhooks when the platform switch is disabled', async () => {
    const { controller, ingestionService } = createController({ platformEnabled: false });

    expect(
      controller.ingestShopifyOrderWebhook({ id: 123 }, request, 'hmac'),
    ).toMatchObject({
      eventType: 'order',
      platform: 'shopify',
      status: 'ignored',
    });
    expect(ingestionService.ingestShopify).not.toHaveBeenCalled();
  });
});
