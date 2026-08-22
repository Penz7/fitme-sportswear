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

  it('stores and enqueues a Shopify order webhook with the Shopify topic', async () => {
    const { prisma, service } = createService();
    const rawPayload = JSON.stringify({ id: 12345, name: '#1001' });

    const result = await service.ingestShopify('orders/create', rawPayload);

    expect(result).toMatchObject({
      id: 'webhook-event-1',
      duplicate: false,
      eventType: 'orders/create',
    });
    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: expect.stringMatching(/^shopify:orders\/create:12345:[a-f0-9]{32}$/),
        scope: 'webhook:shopify',
      }),
    });
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourcePlatform: 'shopify',
        eventType: 'orders/create',
        externalEventId: '12345',
        payload: { id: 12345, name: '#1001' },
      }),
    });
  });

  it('uses distinct Shopify idempotency keys for order create and cancelled topics', async () => {
    const { prisma, service } = createService();

    await service.ingestShopify(
      'orders/create',
      JSON.stringify({ id: 12345, name: '#1001' }),
    );
    await service.ingestShopify(
      'orders/cancelled',
      JSON.stringify({
        id: 12345,
        name: '#1001',
        cancelled_at: '2026-08-05T10:51:58+07:00',
      }),
    );

    const createdKeys = prisma.idempotencyKey.create.mock.calls.map(
      ([call]) => call.data.key,
    );
    expect(createdKeys).toHaveLength(2);
    expect(createdKeys[0]).toMatch(/^shopify:orders\/create:12345:[a-f0-9]{32}$/);
    expect(createdKeys[1]).toMatch(/^shopify:orders\/cancelled:12345:[a-f0-9]{32}$/);
    expect(createdKeys[0]).not.toBe(createdKeys[1]);
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

  it('includes a payload fingerprint for Pancake order update idempotency keys', async () => {
    const { prisma, service } = createService();

    await service.ingestPancake(
      JSON.stringify({ id: 'pancake-order-1', type: 'orders', event_type: 'update', status: 1 }),
    );
    await service.ingestPancake(
      JSON.stringify({ id: 'pancake-order-1', type: 'orders', event_type: 'update', status: 8 }),
    );

    const createdKeys = prisma.idempotencyKey.create.mock.calls.map(
      ([call]) => call.data.key,
    );
    expect(createdKeys).toHaveLength(2);
    expect(createdKeys[0]).toMatch(/^pancake:order_updated:pancake-order-1:[a-f0-9]{32}$/);
    expect(createdKeys[1]).toMatch(/^pancake:order_updated:pancake-order-1:[a-f0-9]{32}$/);
    expect(createdKeys[0]).not.toBe(createdKeys[1]);
  });

  it('keeps stable idempotency keys for Pancake order create events', async () => {
    const { prisma, service } = createService();

    await service.ingestPancake(
      JSON.stringify({ id: 'pancake-order-1', type: 'orders', event_type: 'create', status: 0 }),
    );

    expect(prisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'pancake:order_created:pancake-order-1',
      }),
    });
  });

  it('throws a clear error for invalid JSON', async () => {
    const { service } = createService();

    await expect(service.ingestPancake('{bad json')).rejects.toThrow(
      'Invalid webhook JSON payload',
    );
  });
});
