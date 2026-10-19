import { SapoTopOrderSyncService } from './sapo-top-order-sync.service';

describe('SapoTopOrderSyncService', () => {
  function createService() {
    const prisma = {
      sapoOrderTracking: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      orderMapping: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const sapoClient = {
      fetchOrders: jest.fn().mockResolvedValue({
        orders: [
          { id: 'order-1', code: 'AUTO_PANCAKE_order-1', status: 'draft' },
          { id: 'order-2', code: 'AUTO_PANCAKE_order-2', status: 'draft' },
        ],
        metadata: { total: 2 },
      }),
      fetchOrder: jest.fn(),
    };
    const orderSyncService = {
      syncSapoOrder: jest.fn().mockResolvedValue({
        action: 'created',
        sapoOrderId: 'order-1',
        pancakeOrderId: 'pancake-order-1',
      }),
    };
    const shopifyClient = {
      cancelOrder: jest.fn().mockResolvedValue(undefined),
      closeOrder: jest.fn().mockResolvedValue(undefined),
      createFulfillment: jest.fn().mockResolvedValue(true),
      updateFulfillmentTracking: jest.fn().mockResolvedValue(undefined),
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'shopify-order-1',
        line_items: [{ id: 'line-item-1', quantity: 1 }],
      }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | undefined> = {
          'shipping.viettelPost.trackingCompany': 'Viettel',
        };
        return values[key];
      }),
    };

    return {
      prisma,
      sapoClient,
      orderSyncService,
      shopifyClient,
      configService,
      service: new SapoTopOrderSyncService(
        prisma as any,
        sapoClient as any,
        orderSyncService as any,
        shopifyClient as any,
        configService as any,
      ),
    };
  }

  it('syncs only Sapo orders that are not in the tracking snapshot', async () => {
    const { service, prisma, orderSyncService } = createService();
    prisma.sapoOrderTracking.findUnique.mockResolvedValueOnce({
      type: 'PLACED_AUTO_PANCAKE',
      orderIds: ['order-1'],
    });

    const result = await service.syncOrderType({
      orderType: 'PLACED',
      prefix: 'AUTO_PANCAKE',
    });

    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledTimes(1);
    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledWith({
      id: 'order-2',
      code: 'AUTO_PANCAKE_order-2',
      status: 'draft',
    });
    expect(prisma.sapoOrderTracking.upsert).toHaveBeenCalledWith({
      where: { type: 'PLACED_AUTO_PANCAKE' },
      create: {
        type: 'PLACED_AUTO_PANCAKE',
        orderIds: ['order-1', 'order-2'],
        lastUpdate: expect.any(Date),
      },
      update: {
        orderIds: ['order-1', 'order-2'],
        lastUpdate: expect.any(Date),
      },
    });
    expect(result).toEqual({
      orderType: 'PLACED',
      prefix: 'AUTO_PANCAKE',
      fetched: 2,
      processed: 1,
      skippedTracked: 1,
      results: [
        {
          action: 'created',
          sapoOrderId: 'order-1',
          pancakeOrderId: 'pancake-order-1',
        },
      ],
    });
  });

  it('does not send unprefixed Sapo top orders to Pancake when no mapping exists', async () => {
    const { service, prisma, sapoClient, orderSyncService } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [{ id: 'order-1', code: 'SO123', status: 'draft' }],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce(null);

    const result = await service.syncOrderType({
      orderType: 'PLACED',
      prefix: 'AUTO_PANCAKE',
    });

    expect(prisma.orderMapping.findFirst).toHaveBeenCalledWith({
      where: { sapoOrderId: 'order-1' },
    });
    expect(orderSyncService.syncSapoOrder).not.toHaveBeenCalled();
    expect(result.results).toEqual([
      {
        action: 'skipped',
        sapoOrderId: 'order-1',
        pancakeOrderId: null,
      },
    ]);
  });

  it('keeps syncing unprefixed Sapo top orders that already have a Pancake mapping', async () => {
    const { service, prisma, sapoClient, orderSyncService } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [{ id: 'order-1', code: 'SO123', status: 'draft' }],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    await service.syncOrderType({
      orderType: 'PLACED',
      prefix: 'AUTO_PANCAKE',
    });

    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledWith({
      id: 'order-1',
      code: 'SO123',
      status: 'draft',
    });
  });

  it('records a failed Pancake order update and continues syncing the remaining top orders', async () => {
    const { service, prisma, sapoClient, orderSyncService } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        { id: 'order-1', code: 'SO123', status: 'draft' },
        { id: 'order-2', code: 'SO124', status: 'draft' },
      ],
      metadata: { total: 2 },
    });
    prisma.orderMapping.findFirst
      .mockResolvedValueOnce({
        id: 'mapping-1',
        sapoOrderId: 'order-1',
        pancakeOrderId: 'pancake-order-1',
      })
      .mockResolvedValueOnce({
        id: 'mapping-1',
        sapoOrderId: 'order-1',
        pancakeOrderId: 'pancake-order-1',
      })
      .mockResolvedValueOnce({
        id: 'mapping-2',
        sapoOrderId: 'order-2',
        pancakeOrderId: 'pancake-order-2',
      });
    orderSyncService.syncSapoOrder
      .mockRejectedValueOnce(new Error('Pancake order update failed with status 500'))
      .mockResolvedValueOnce({
        action: 'updated',
        sapoOrderId: 'order-2',
        pancakeOrderId: 'pancake-order-2',
      });

    const result = await service.syncOrderType({
      orderType: 'PLACED',
      prefix: 'AUTO_PANCAKE',
    });

    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledTimes(2);
    expect(result.results).toEqual([
      {
        action: 'failed',
        sapoOrderId: 'order-1',
        pancakeOrderId: 'pancake-order-1',
        error: 'Pancake order update failed with status 500',
      },
      {
        action: 'updated',
        sapoOrderId: 'order-2',
        pancakeOrderId: 'pancake-order-2',
      },
    ]);
    expect(prisma.sapoOrderTracking.upsert).toHaveBeenCalledWith({
      where: { type: 'PLACED_AUTO_PANCAKE' },
      create: {
        type: 'PLACED_AUTO_PANCAKE',
        orderIds: ['order-1', 'order-2'],
        lastUpdate: expect.any(Date),
      },
      update: {
        orderIds: ['order-1', 'order-2'],
        lastUpdate: expect.any(Date),
      },
    });
  });

  it('uses the Java Sapo status value as the fetch filter', async () => {
    const { service, sapoClient } = createService();

    await service.syncOrderType({
      orderType: 'SHIPPED',
      prefix: 'AUTO_PANCAKE',
      limit: 25,
    });

    expect(sapoClient.fetchOrders).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      status: 'finalized',
    });
  });

  it('syncs all Java Pancake order types when no specific type is provided', async () => {
    const { service, sapoClient } = createService();

    const result = await service.syncAllPancakeOrderTypes({ limit: 10 });

    expect(sapoClient.fetchOrders).toHaveBeenCalledTimes(10);
    expect(result.orderTypes).toHaveLength(10);
  });

  it('cancels mapped Shopify orders for Sapo canceled AUTO_SHOPIFY top orders', async () => {
    const { service, prisma, sapoClient, orderSyncService, shopifyClient } =
      createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [{ id: 'sapo-order-1', status: 'cancelled' }],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    const result = await service.syncOrderType({
      orderType: 'CANCELED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(orderSyncService.syncSapoOrder).not.toHaveBeenCalled();
    expect(shopifyClient.cancelOrder).toHaveBeenCalledWith(
      'shopify-order-1',
      'Cancelled by Sapo',
    );
    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: expect.objectContaining({
        shopifyStatus: 'CANCELLED',
        sapoStatus: 'cancelled',
      }),
    });
    expect(result.results).toEqual([
      {
        action: 'updated',
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: null,
      },
    ]);
  });

  it('creates Shopify fulfillment for shipped AUTO_SHOPIFY Sapo orders with tracking', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'finalized',
          fulfillment_status: 'shipped',
          fulfillments: [
            {
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'VTP123',
              },
            },
          ],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    const result = await service.syncOrderType({
      orderType: 'SHIPPED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith({
      orderId: 'shopify-order-1',
      trackingCompany: 'Viettel',
      trackingNumber: 'VTP123',
      notifyCustomer: true,
      lineItems: [{ id: 'line-item-1', quantity: 1 }],
    });
    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: expect.objectContaining({
        shopifyStatus: 'FULFILLED',
        sapoFulfillmentStatus: 'shipped',
      }),
    });
    expect(result.results[0]).toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: null,
    });
  });

  it('keeps a shipped mapping retryable when Shopify does not confirm fulfillment creation', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'finalized',
          fulfillment_status: 'shipped',
          fulfillments: [
            {
              status: 'fulfilled',
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'VTP123',
              },
            },
          ],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });
    shopifyClient.createFulfillment.mockResolvedValueOnce(false);

    await service.syncOrderType({ orderType: 'SHIPPED', prefix: 'AUTO_SHOPIFY' });

    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: expect.objectContaining({ shopifyStatus: 'SHIPPED' }),
    });
  });

  it('recovers an open Shopify mapping that has fallen outside the newest Sapo list page', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [],
      metadata: { total: 50 },
    });
    prisma.orderMapping.findMany.mockResolvedValueOnce([
      { sapoOrderId: 'sapo-order-older' },
    ]);
    sapoClient.fetchOrder.mockResolvedValueOnce({
      order: {
        id: 'sapo-order-older',
        status: 'finalized',
        fulfillment_status: 'shipped',
        fulfillments: [
          {
            status: 'fulfilled',
            shipment: {
              pushing_status: 'completed',
              tracking_code: 'VTP-OLDER',
            },
          },
        ],
      },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-older',
      sapoOrderId: 'sapo-order-older',
      shopifyOrderId: 'shopify-order-older',
    });
    shopifyClient.fetchOrder.mockResolvedValueOnce({
      id: 'shopify-order-older',
      line_items: [{ id: 'line-item-1', quantity: 1 }],
    });

    const result = await service.syncOrderType({
      orderType: 'SHIPPED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(sapoClient.fetchOrder).toHaveBeenCalledWith('sapo-order-older');
    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({ trackingNumber: 'VTP-OLDER' }),
    );
    expect(result).toEqual(
      expect.objectContaining({ processed: 1, skippedTracked: 0 }),
    );
  });

  it('does not fulfill a packed AUTO_SHOPIFY order before Sapo marks it shipped', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'finalized',
          packed_status: 'packed',
          fulfillment_status: 'unshipped',
          fulfillments: [
            {
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'VTP123',
              },
            },
          ],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.sapoOrderTracking.findUnique.mockResolvedValueOnce({
      type: 'PACKED_AUTO_SHOPIFY',
      orderIds: ['sapo-order-1'],
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    const result = await service.syncOrderType({
      orderType: 'PACKED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.createFulfillment).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(result.skippedTracked).toBe(1);
    expect(prisma.orderMapping.update).not.toHaveBeenCalled();
  });

  it('fetches Sapo order details for a tracked Shopify order when the list payload has no shipment', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'finalized',
          packed_status: 'packed',
          fulfillment_status: 'unshipped',
        },
      ],
      metadata: { total: 1 },
    });
    prisma.sapoOrderTracking.findUnique.mockResolvedValueOnce({
      type: 'PACKED_AUTO_SHOPIFY',
      orderIds: ['sapo-order-1'],
    });
    prisma.orderMapping.findMany.mockResolvedValueOnce([
      { sapoOrderId: 'sapo-order-1' },
    ]);
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });
    sapoClient.fetchOrder.mockResolvedValueOnce({
      order: {
        id: 'sapo-order-1',
        status: 'finalized',
        packed_status: 'packed',
        fulfillment_status: 'shipped',
        fulfillments: [
          {
            shipment: {
              pushing_status: 'completed',
              tracking_code: 'VTP123',
            },
          },
        ],
      },
    });

    const result = await service.syncOrderType({
      orderType: 'PACKED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(sapoClient.fetchOrder).toHaveBeenCalledWith('sapo-order-1');
    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({ trackingNumber: 'VTP123' }),
    );
    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: expect.objectContaining({ shopifyStatus: 'FULFILLED' }),
    });
    expect(result).toEqual(
      expect.objectContaining({ processed: 1, skippedTracked: 0 }),
    );
  });

  it('does not create Shopify fulfillment for shipped AUTO_SHOPIFY orders with uncompleted tracking', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'finalized',
          fulfillment_status: 'shipped',
          fulfillments: [
            {
              shipment: {
                pushing_status: 'pending',
                tracking_code: 'PACKING-CODE-1',
              },
            },
          ],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    const result = await service.syncOrderType({
      orderType: 'SHIPPED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.createFulfillment).not.toHaveBeenCalled();
    expect(result.results[0]).toEqual({
      action: 'skipped',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: null,
    });
  });

  it('ignores a cancelled Sapo fulfillment when a replacement shipment exists', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'completed',
          fulfillment_status: 'shipped',
          fulfillments: [
            {
              status: 'cancelled',
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'OLD-CANCELLED-CODE',
              },
            },
            {
              status: 'received',
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'NEW-ACTIVE-CODE',
              },
            },
          ],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    await service.syncOrderType({
      orderType: 'COMPLETED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({ trackingNumber: 'NEW-ACTIVE-CODE' }),
    );
  });

  it('corrects an already fulfilled Shopify order with Sapo replacement tracking without another email', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'finalized',
          fulfillment_status: 'shipped',
          fulfillments: [
            {
              status: 'cancelled',
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'OLD-CANCELLED-CODE',
              },
            },
            {
              status: 'received',
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'NEW-ACTIVE-CODE',
              },
            },
          ],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });
    shopifyClient.fetchOrder.mockResolvedValueOnce({
      id: 'shopify-order-1',
      fulfillment_status: 'fulfilled',
      fulfillments: [{ id: 'fulfillment-1', tracking_numbers: ['OLD-CANCELLED-CODE'] }],
    });

    await service.syncOrderType({
      orderType: 'SHIPPED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.updateFulfillmentTracking).toHaveBeenCalledWith({
      fulfillmentId: 'fulfillment-1',
      trackingCompany: 'Viettel',
      trackingNumber: 'NEW-ACTIVE-CODE',
      notifyCustomer: false,
    });
    expect(shopifyClient.createFulfillment).not.toHaveBeenCalled();
  });

  it('closes Shopify order for completed AUTO_SHOPIFY Sapo orders', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'completed',
          fulfillments: [{ shipment: { tracking_code: 'VTP123' } }],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    await service.syncOrderType({
      orderType: 'COMPLETED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.closeOrder).toHaveBeenCalledWith('shopify-order-1');
    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: expect.objectContaining({
        shopifyStatus: 'FULFILLED',
        sapoStatus: 'completed',
      }),
    });
  });

  it('fulfills a completed AUTO_SHOPIFY Sapo order without tracking but does not notify the customer', async () => {
    const { service, prisma, sapoClient, shopifyClient } = createService();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [
        {
          id: 'sapo-order-1',
          status: 'completed',
          fulfillment_status: 'shipped',
          fulfillments: [{ status: 'received' }],
        },
      ],
      metadata: { total: 1 },
    });
    prisma.orderMapping.findFirst.mockResolvedValueOnce({
      id: 'mapping-1',
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });

    await service.syncOrderType({
      orderType: 'COMPLETED',
      prefix: 'AUTO_SHOPIFY',
    });

    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith({
      orderId: 'shopify-order-1',
      notifyCustomer: false,
      lineItems: [{ id: 'line-item-1', quantity: 1 }],
    });
  });
});
