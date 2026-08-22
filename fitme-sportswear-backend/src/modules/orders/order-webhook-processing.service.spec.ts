import { OrderWebhookProcessingService } from './order-webhook-processing.service';
import { OrderInventoryImpactService } from './order-inventory-impact.service';

describe('OrderWebhookProcessingService', () => {
  const service = new OrderWebhookProcessingService(
    new OrderInventoryImpactService(),
  );

  it('plans Pancake order creation as Sapo order creation', () => {
    const result = service.buildProcessingPlan({
      id: 'event-1',
      sourcePlatform: 'pancake',
      eventType: 'order_created',
      externalEventId: 'pancake-order-1',
      payload: {
        id: 'pancake-order-1',
        status: 0,
        bill_full_name: 'Nguyen Van A',
      },
    } as any);

    expect(result).toEqual({
      platform: 'pancake',
      eventType: 'order_created',
      externalOrderId: 'pancake-order-1',
      statusCode: 0,
      statusDescription: 'Moi',
      quantityEffect: 'available_only',
      sapoStatuses: [{ key: 'DAT_HANG', field: 'status', value: 'draft' }],
      nextActions: ['create_sapo_order', 'finalize_sapo_order', 'upsert_order_mapping'],
    });
  });

  it('plans Pancake confirmed update as Sapo order update only', () => {
    const result = service.buildProcessingPlan({
      id: 'event-2',
      sourcePlatform: 'pancake',
      eventType: 'order_updated',
      externalEventId: 'pancake-order-2',
      payload: {
        id: 'pancake-order-2',
        status: 1,
      },
    } as any);

    expect(result.nextActions).toEqual(['update_sapo_order', 'upsert_order_mapping']);
    expect(result.sapoStatuses).toEqual([
      { key: 'GIAO_DICH', field: 'status', value: 'finalized' },
      { key: 'CHUA_DONG_GOI', field: 'packed_status', value: 'unpacked' },
    ]);
  });

  it('plans Pancake packing and shipped updates as Sapo fulfillment state changes', () => {
    expect(
      service.buildProcessingPlan({
        id: 'event-3',
        sourcePlatform: 'pancake',
        eventType: 'order_updated',
        payload: { id: 'pancake-order-3', status: 8 },
      } as any).nextActions,
    ).toEqual(['ensure_sapo_fulfillment', 'upsert_order_mapping']);

    expect(
      service.buildProcessingPlan({
        id: 'event-4',
        sourcePlatform: 'pancake',
        eventType: 'order_updated',
        payload: { id: 'pancake-order-4', status: 2 },
      } as any).nextActions,
    ).toEqual([
      'ensure_sapo_fulfillment',
      'deliver_sapo_order',
      'upsert_order_mapping',
    ]);
  });

  it('plans Pancake money-collected updates as payment-only mapping updates', () => {
    const result = service.buildProcessingPlan({
      id: 'event-money-collected',
      sourcePlatform: 'pancake',
      eventType: 'order_updated',
      payload: { id: 'pancake-order-paid', status: 16 },
    } as any);

    expect(result.statusDescription).toBe('Da thu tien');
    expect(result.sapoStatuses).toEqual([
      { key: 'DA_THANH_TOAN', field: 'payment_status', value: 'paid' },
    ]);
    expect(result.nextActions).toEqual(['upsert_order_mapping']);
  });

  it('plans Pancake cancel update with cancellation actions', () => {
    const result = service.buildProcessingPlan({
      id: 'event-5',
      sourcePlatform: 'pancake',
      eventType: 'order_updated',
      payload: { id: 'pancake-order-5', status: 6 },
    } as any);

    expect(result.quantityEffect).toBe('remain_and_available');
    expect(result.nextActions).toEqual([
      'cancel_sapo_delivery_if_exists',
      'receive_after_cancellation_if_needed',
      'cancel_sapo_order',
      'upsert_order_mapping',
    ]);
  });

  it('uses OrderInventoryImpactService to resolve Pancake quantity effect', () => {
    const impactService = {
      resolvePancakeImpact: jest.fn().mockReturnValue({
        quantityEffect: 'remain_only',
      }),
    };
    const processingService = new OrderWebhookProcessingService(
      impactService as any,
    );

    const result = processingService.buildProcessingPlan({
      sourcePlatform: 'pancake',
      eventType: 'order_updated',
      payload: { id: 'pancake-order-5', status: 6 },
    });

    expect(impactService.resolvePancakeImpact).toHaveBeenCalledWith(6);
    expect(result.quantityEffect).toBe('remain_only');
  });

  it('ignores Pancake orders that do not match the configured test marker', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'pancake.testOrderFilter' ? 'WEBHOOK_TEST' : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      sourcePlatform: 'pancake',
      eventType: 'order_created',
      externalEventId: 'real-order-1',
      payload: { id: 'real-order-1', status: 0, note: 'normal order' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        externalOrderId: 'real-order-1',
        statusDescription: 'PANCAKE_TEST_FILTER_IGNORED',
        nextActions: ['ignore'],
      }),
    );
  });

  it('processes Pancake orders that match the configured test marker', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'pancake.testOrderFilter' ? 'WEBHOOK_TEST' : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      sourcePlatform: 'pancake',
      eventType: 'order_created',
      externalEventId: 'test-order-1',
      payload: { id: 'test-order-1', status: 0, note_print: ' WEBHOOK_TEST ' },
    });

    expect(result.nextActions).toEqual([
      'create_sapo_order',
      'finalize_sapo_order',
      'upsert_order_mapping',
    ]);
  });

  it('ignores Pancake webhooks when Pancake channel is disabled', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'webhook.pancake.enabled' ? false : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      sourcePlatform: 'pancake',
      eventType: 'order_created',
      externalEventId: 'pancake-order-disabled',
      payload: { id: 'pancake-order-disabled', status: 0, note: 'WEBHOOK_TEST' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        platform: 'pancake',
        externalOrderId: 'pancake-order-disabled',
        statusDescription: 'PANCAKE_WEBHOOK_DISABLED',
        nextActions: ['ignore'],
      }),
    );
  });

  it('plans Shopify order webhook using the legacy order-to-Sapo plus fulfillment flow', () => {
    const result = service.buildProcessingPlan({
      id: 'event-6',
      sourcePlatform: 'shopify',
      eventType: 'orders/create',
      externalEventId: '12345',
      payload: {
        id: 12345,
        order_number: 1001,
      },
    } as any);

    expect(result).toEqual({
      platform: 'shopify',
      eventType: 'orders/create',
      externalOrderId: '12345',
      statusCode: null,
      statusDescription: 'ORDER_WEBHOOK',
      quantityEffect: 'none',
      sapoStatuses: [],
      nextActions: [
        'create_sapo_order_if_missing',
        'finalize_sapo_order',
        'update_sapo_order',
        'create_sapo_fulfillment',
        'create_shopify_fulfillment',
        'upsert_order_mapping',
      ],
    });
  });

  it('ignores Shopify orders that do not match the configured test marker', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'shopify.testOrderFilter' ? 'WEBHOOK_TEST' : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      id: 'event-shopify-filtered',
      sourcePlatform: 'shopify',
      eventType: 'orders/create',
      externalEventId: 'shopify-real-order',
      payload: { id: 'shopify-real-order', note: 'normal order' },
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        platform: 'shopify',
        externalOrderId: 'shopify-real-order',
        statusDescription: 'SHOPIFY_TEST_FILTER_IGNORED',
        nextActions: ['ignore'],
      }),
    );
  });

  it('processes Shopify orders that match the configured test marker', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'shopify.testOrderFilter' ? 'WEBHOOK_TEST' : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      id: 'event-shopify-test-order',
      sourcePlatform: 'shopify',
      eventType: 'orders/create',
      externalEventId: 'shopify-test-order',
      payload: {
        id: 'shopify-test-order',
        note_attributes: [{ name: 'test_marker', value: 'WEBHOOK_TEST' }],
      },
    } as any);

    expect(result.nextActions).toEqual([
      'create_sapo_order_if_missing',
      'finalize_sapo_order',
      'update_sapo_order',
      'create_sapo_fulfillment',
      'create_shopify_fulfillment',
      'upsert_order_mapping',
    ]);
  });

  it('plans Shopify cancelled orders as Sapo cancellation actions', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'shopify.testOrderFilter' ? 'WEBHOOK_TEST' : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      id: 'event-shopify-cancelled',
      sourcePlatform: 'shopify',
      eventType: 'orders/cancelled',
      externalEventId: 'shopify-order-1',
      payload: {
        id: 'shopify-order-1',
        cancelled_at: '2026-06-16T16:10:00+07:00',
        note: 'WEBHOOK_TEST',
      },
    } as any);

    expect(result.statusDescription).toBe('SHOPIFY_CANCELLED');
    expect(result.nextActions).toEqual([
      'cancel_sapo_delivery_if_exists',
      'receive_after_cancellation_if_needed',
      'cancel_sapo_order',
      'upsert_order_mapping',
    ]);
  });

  it('ignores Shopify webhooks when Shopify channel is disabled', () => {
    const processingService = new OrderWebhookProcessingService(
      new OrderInventoryImpactService(),
      { get: (key: string) => (key === 'webhook.shopify.enabled' ? false : undefined) } as any,
    );

    const result = processingService.buildProcessingPlan({
      id: 'event-shopify-disabled',
      sourcePlatform: 'shopify',
      eventType: 'order',
      externalEventId: 'shopify-order-disabled',
      payload: { id: 'shopify-order-disabled' },
    } as any);

    expect(result).toEqual(
      expect.objectContaining({
        platform: 'shopify',
        externalOrderId: 'shopify-order-disabled',
        statusDescription: 'SHOPIFY_WEBHOOK_DISABLED',
        nextActions: ['ignore'],
      }),
    );
  });

  it('explicitly ignores Shopify product and fulfillment webhooks', () => {
    expect(
      service.buildProcessingPlan({
        id: 'event-7',
        sourcePlatform: 'shopify',
        eventType: 'product',
        externalEventId: 'shopify-product-1',
        payload: { id: 'shopify-product-1' },
      } as any),
    ).toEqual(
      expect.objectContaining({
        statusDescription: 'SHOPIFY_PRODUCT_WEBHOOK_IGNORED_PRODUCT_SYNC_IS_SCHEDULED',
        nextActions: ['ignore'],
      }),
    );

    expect(
      service.buildProcessingPlan({
        id: 'event-8',
        sourcePlatform: 'shopify',
        eventType: 'fulfillment',
        externalEventId: 'shopify-fulfillment-1',
        payload: { id: 'shopify-fulfillment-1' },
      } as any),
    ).toEqual(
      expect.objectContaining({
        statusDescription: 'SHOPIFY_FULFILLMENT_WEBHOOK_IGNORED_NOT_SUPPORTED_YET',
        nextActions: ['ignore'],
      }),
    );
  });

  it('ignores unsupported webhook event types without throwing', () => {
    const result = service.buildProcessingPlan({
      id: 'event-9',
      sourcePlatform: 'pancake',
      eventType: 'inventory_check',
      payload: { inventory: {} },
    } as any);

    expect(result.nextActions).toEqual(['ignore']);
    expect(result.externalOrderId).toBeNull();
  });
});
