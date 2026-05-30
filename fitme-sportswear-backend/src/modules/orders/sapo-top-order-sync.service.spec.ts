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
      },
    };
    const sapoClient = {
      fetchOrders: jest.fn().mockResolvedValue({
        orders: [
          { id: 'order-1', status: 'draft' },
          { id: 'order-2', status: 'draft' },
        ],
        metadata: { total: 2 },
      }),
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
    };

    return {
      prisma,
      sapoClient,
      orderSyncService,
      shopifyClient,
      service: new SapoTopOrderSyncService(
        prisma as any,
        sapoClient as any,
        orderSyncService as any,
        shopifyClient as any,
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
    expect(result.results).toEqual([
      {
        action: 'updated',
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: null,
      },
    ]);
  });
});
