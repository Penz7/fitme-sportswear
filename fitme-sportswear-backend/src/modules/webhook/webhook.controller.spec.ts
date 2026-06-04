import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookController } from './webhook.controller';

describe('WebhookController', () => {
  function createController(overrides: Record<string, unknown> = {}) {
    const configValues: Record<string, unknown> = {
      'webhooks.ingestionEnabled': false,
      'webhooks.pancake.enabled': false,
      ...overrides,
    };
    const ingestionService = {
      ingestPancake: jest.fn().mockResolvedValue({
        id: 'webhook-event-1',
        duplicate: false,
        eventType: 'order_created',
        status: 'queued',
      }),
      ingestShopify: jest.fn(),
    };
    const shopifyHmacService = {
      verify: jest.fn().mockReturnValue(true),
    };
    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    return {
      configService,
      ingestionService,
      controller: new WebhookController(
        ingestionService as any,
        shopifyHmacService as any,
        configService,
      ),
    };
  }

  it('rejects Pancake webhook when global ingestion is disabled', async () => {
    const { controller, ingestionService } = createController({
      'webhooks.ingestionEnabled': false,
      'webhooks.pancake.enabled': true,
    });

    expect(() =>
      controller.ingestPancakeWebhook({ id: 'order-1' }, {} as any),
    ).toThrow(ServiceUnavailableException);
    expect(ingestionService.ingestPancake).not.toHaveBeenCalled();
  });

  it('rejects Pancake webhook when Pancake ingestion is disabled', async () => {
    const { controller, ingestionService } = createController({
      'webhooks.ingestionEnabled': true,
      'webhooks.pancake.enabled': false,
    });

    expect(() =>
      controller.ingestLegacyPancakeWebhook({ id: 'order-1' }, {} as any),
    ).toThrow(ServiceUnavailableException);
    expect(ingestionService.ingestPancake).not.toHaveBeenCalled();
  });

  it('ingests Pancake webhook when both switches are enabled', async () => {
    const { controller, ingestionService } = createController({
      'webhooks.ingestionEnabled': true,
      'webhooks.pancake.enabled': true,
    });

    await expect(
      controller.ingestPancakeWebhook(
        { id: 'order-1', type: 'orders', event_type: 'create' },
        {} as any,
      ),
    ).resolves.toMatchObject({
      id: 'webhook-event-1',
      eventType: 'order_created',
      status: 'queued',
    });
    expect(ingestionService.ingestPancake).toHaveBeenCalledWith(
      JSON.stringify({ id: 'order-1', type: 'orders', event_type: 'create' }),
    );
  });
});
