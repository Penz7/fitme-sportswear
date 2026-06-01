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

  it('plans Pancake confirmed update as Sapo order update and shipping handoff preparation', () => {
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

    expect(result.nextActions).toEqual([
      'update_sapo_order',
      'prepare_viettelpost_handoff',
      'upsert_order_mapping',
    ]);
    expect(result.sapoStatuses).toEqual([
      { key: 'GIAO_DICH', field: 'status', value: 'finalized' },
      { key: 'CHUA_DONG_GOI', field: 'packed_status', value: 'unpacked' },
    ]);
  });

  it('plans Pancake packing and shipped updates with fulfillment actions', () => {
    expect(
      service.buildProcessingPlan({
        id: 'event-3',
        sourcePlatform: 'pancake',
        eventType: 'order_updated',
        payload: { id: 'pancake-order-3', status: 8 },
      } as any).nextActions,
    ).toEqual(['create_sapo_fulfillment', 'upsert_order_mapping']);

    expect(
      service.buildProcessingPlan({
        id: 'event-4',
        sourcePlatform: 'pancake',
        eventType: 'order_updated',
        payload: { id: 'pancake-order-4', status: 2 },
      } as any).nextActions,
    ).toEqual(['ensure_sapo_fulfillment', 'deliver_sapo_order', 'upsert_order_mapping']);
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

  it('plans Shopify order webhook using the legacy order-to-Sapo plus fulfillment flow', () => {
    const result = service.buildProcessingPlan({
      id: 'event-6',
      sourcePlatform: 'shopify',
      eventType: 'order',
      externalEventId: '12345',
      payload: {
        id: 12345,
        order_number: 1001,
      },
    } as any);

    expect(result).toEqual({
      platform: 'shopify',
      eventType: 'order',
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
