import { ShopifyWebhookStartupService } from './shopify-webhook-startup.service';

describe('ShopifyWebhookStartupService', () => {
  function createService(
    values: Record<string, string | boolean | undefined> = {},
  ) {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    };
    const shopifyClient = {
      ensureWebhook: jest.fn().mockResolvedValue('updated'),
    };

    return {
      configService,
      shopifyClient,
      service: new ShopifyWebhookStartupService(
        configService as any,
        shopifyClient as any,
      ),
    };
  }

  it('does not ensure Shopify webhooks unless a public base URL is configured', async () => {
    const { service, shopifyClient } = createService({
      'shopify.webhookAutoRegisterEnabled': true,
      'shopify.webhookPublicBaseUrl': '',
    });

    await service.onApplicationBootstrap();

    expect(shopifyClient.ensureWebhook).not.toHaveBeenCalled();
  });

  it('does not ensure Shopify webhooks in API-only processes', async () => {
    const { service, shopifyClient } = createService({
      'shopify.webhookAutoRegisterEnabled': true,
      'shopify.webhookPublicBaseUrl': 'https://tunnel.example.com',
      'queue.processorsEnabled': false,
    });

    await service.onApplicationBootstrap();

    expect(shopifyClient.ensureWebhook).not.toHaveBeenCalled();
  });

  it('ensures Shopify order webhooks on startup with the configured public URL', async () => {
    const { service, shopifyClient } = createService({
      'shopify.webhookAutoRegisterEnabled': true,
      'shopify.webhookPublicBaseUrl': 'https://tunnel.example.com/',
      'queue.processorsEnabled': true,
    });

    await service.onApplicationBootstrap();

    expect(shopifyClient.ensureWebhook).toHaveBeenNthCalledWith(1, {
      topic: 'orders/create',
      address: 'https://tunnel.example.com/webhooks/shopify/order',
      format: 'json',
    });
    expect(shopifyClient.ensureWebhook).toHaveBeenNthCalledWith(2, {
      topic: 'orders/updated',
      address: 'https://tunnel.example.com/webhooks/shopify/order',
      format: 'json',
    });
    expect(shopifyClient.ensureWebhook).toHaveBeenNthCalledWith(3, {
      topic: 'orders/cancelled',
      address: 'https://tunnel.example.com/webhooks/shopify/order',
      format: 'json',
    });
  });
});
