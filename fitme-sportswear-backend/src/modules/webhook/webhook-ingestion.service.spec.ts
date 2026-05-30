import { WebhookIngestionService } from './webhook-ingestion.service';

describe('WebhookIngestionService', () => {
  function createService() {
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      webhookEvent: {
        create: jest.fn().mockResolvedValue({
          id: 'webhook-event-1',
          status: 'queued',
        }),
      },
    };
    const producer = {
      enqueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    return {
      prisma,
      producer,
      service: new WebhookIngestionService(prisma as any, producer as any),
    };
  }

  it('stores and enqueues a Pancake webhook with a resolved event type', async () => {
    const { prisma, producer, service } = createService();
    const rawPayload = JSON.stringify({
      id: 'pancake-order-1',
      type: 'orders',
      event_type: 'create',
    });

    const result = await service.ingestPancake(rawPayload);

    expect(result).toEqual({
      id: 'webhook-event-1',
      duplicate: false,
      eventType: 'order_created',
      status: 'queued',
    });
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'pancake:order_created:pancake-order-1',
        scope: 'webhook:pancake',
      }),
    });
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: {
        sourcePlatform: 'pancake',
        eventType: 'order_created',
        externalEventId: 'pancake-order-1',
        payload: {
          id: 'pancake-order-1',
          type: 'orders',
          event_type: 'create',
        },
        status: 'queued',
      },
    });
    expect(producer.enqueue).toHaveBeenCalledWith({
      webhookEventId: 'webhook-event-1',
    });
  });

  it('stores and enqueues a Shopify order webhook', async () => {
    const { prisma, service } = createService();
    const rawPayload = JSON.stringify({ id: 12345, name: '#1001' });

    const result = await service.ingestShopify('order', rawPayload);

    expect(result).toMatchObject({
      id: 'webhook-event-1',
      duplicate: false,
      eventType: 'order',
    });
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourcePlatform: 'shopify',
        eventType: 'order',
        externalEventId: '12345',
        payload: { id: 12345, name: '#1001' },
      }),
    });
  });

  it('returns duplicate without storing or enqueueing when idempotency key already exists', async () => {
    const { prisma, producer, service } = createService();
    prisma.idempotencyKey.findUnique.mockResolvedValueOnce({ id: 'existing-key' });

    const result = await service.ingestPancake(
      JSON.stringify({ id: 'pancake-order-1', type: 'orders', event_type: 'update' }),
    );

    expect(result).toEqual({
      duplicate: true,
      eventType: 'order_updated',
      status: 'ignored',
    });
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(producer.enqueue).not.toHaveBeenCalled();
  });

  it('throws a clear error for invalid JSON', async () => {
    const { service } = createService();

    await expect(service.ingestPancake('{bad json')).rejects.toThrow(
      'Invalid webhook JSON payload',
    );
  });
});
