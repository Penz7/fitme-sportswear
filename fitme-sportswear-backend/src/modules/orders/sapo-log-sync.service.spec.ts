import { SapoLogSyncService } from './sapo-log-sync.service';

describe('SapoLogSyncService', () => {
  function createService() {
    const prisma = {
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const sapoClient = {
      fetchLogs: jest.fn().mockResolvedValue({
        ids: [101, 102, 103, 104],
        logs: [
          { id: 101, uri: '/admin/orders/5001.json' },
          { id: 102, uri: '/admin/orders/5001/fulfillments.json' },
          { id: 103, uri: '/admin/orders.json', root_id: 5002 },
          { id: 104, uri: '/admin/products/9001.json' },
        ],
      }),
      fetchOrder: jest.fn((orderId: string) =>
        Promise.resolve({ order: { id: orderId, status: 'draft' } }),
      ),
    };
    const orderSyncService = {
      syncSapoOrder: jest.fn().mockResolvedValue({
        action: 'updated',
        sapoOrderId: '5001',
        pancakeOrderId: 'pancake-1',
      }),
    };

    return {
      prisma,
      sapoClient,
      orderSyncService,
      service: new SapoLogSyncService(
        prisma as any,
        sapoClient as any,
        orderSyncService as any,
      ),
    };
  }

  it('extracts distinct Sapo order ids from unseen Sapo logs and syncs each order', async () => {
    const { service, sapoClient, orderSyncService, prisma } = createService();

    const result = await service.syncRecentLogs();

    expect(sapoClient.fetchOrder).toHaveBeenCalledTimes(2);
    expect(sapoClient.fetchOrder).toHaveBeenNthCalledWith(1, '5001');
    expect(sapoClient.fetchOrder).toHaveBeenNthCalledWith(2, '5002');
    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledTimes(2);
    expect(prisma.idempotencyKey.create).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      fetchedLogIds: 4,
      newLogIds: 4,
      extractedOrderIds: ['5001', '5002'],
      processed: 2,
      results: [
        {
          action: 'updated',
          sapoOrderId: '5001',
          pancakeOrderId: 'pancake-1',
        },
        {
          action: 'updated',
          sapoOrderId: '5001',
          pancakeOrderId: 'pancake-1',
        },
      ],
    });
  });

  it('skips logs that already have persisted idempotency keys', async () => {
    const { service, prisma, sapoClient, orderSyncService } = createService();
    prisma.idempotencyKey.findUnique.mockResolvedValue({ id: 'existing-key' });

    const result = await service.syncRecentLogs();

    expect(sapoClient.fetchOrder).not.toHaveBeenCalled();
    expect(orderSyncService.syncSapoOrder).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(result.newLogIds).toBe(0);
  });
});
