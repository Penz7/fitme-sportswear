import { SapoToPancakeOrderSyncProcessor } from './sapo-to-pancake-order-sync.processor';

describe('SapoToPancakeOrderSyncProcessor', () => {
  function createProcessor() {
    const prisma = {
      syncRun: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const sapoClient = {
      fetchOrder: jest.fn().mockResolvedValue({
        order: { id: 'sapo-order-1', status: 'draft' },
      }),
      fetchOrders: jest.fn().mockResolvedValue({
        orders: [],
        metadata: { total: 0 },
      }),
    };
    const orderSyncService = {
      syncSapoOrder: jest.fn().mockResolvedValue({
        action: 'created',
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
      }),
    };
    const topOrderSyncService = {
      syncAllPancakeOrderTypes: jest.fn().mockResolvedValue({
        prefix: 'AUTO_PANCAKE',
        fetched: 2,
        processed: 1,
        skippedTracked: 1,
        orderTypes: [],
      }),
      syncOrderType: jest.fn().mockResolvedValue({
        orderType: 'PLACED',
        prefix: 'AUTO_PANCAKE',
        fetched: 2,
        processed: 1,
        skippedTracked: 1,
        results: [],
      }),
    };
    const logSyncService = {
      syncRecentLogs: jest.fn().mockResolvedValue({
        fetchedLogIds: 2,
        newLogIds: 1,
        extractedOrderIds: ['sapo-order-1'],
        processed: 1,
        results: [],
      }),
    };
    const shopifyOrderReconciliationService = {
      reconcile: jest.fn().mockResolvedValue({
        processed: 1,
        updated: 1,
        skipped: 0,
        results: [],
      }),
    };

    return {
      prisma,
      sapoClient,
      orderSyncService,
      topOrderSyncService,
      logSyncService,
      shopifyOrderReconciliationService,
      processor: new SapoToPancakeOrderSyncProcessor(
        prisma as any,
        sapoClient as any,
        orderSyncService as any,
        topOrderSyncService as any,
        logSyncService as any,
        shopifyOrderReconciliationService as any,
      ),
    };
  }

  it('fetches Sapo order and stores sync result metadata', async () => {
    const { processor, prisma, sapoClient, orderSyncService } = createProcessor();

    await processor.process({
      data: { syncRunId: 'sync-run-1', sapoOrderId: 'sapo-order-1' },
    } as any);

    expect(prisma.syncRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sync-run-1' },
      data: { status: 'running', startedAt: expect.any(Date) },
    });
    expect(sapoClient.fetchOrder).toHaveBeenCalledWith('sapo-order-1');
    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledWith({
      id: 'sapo-order-1',
      status: 'draft',
    });
    expect(prisma.syncRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'sync-run-1' },
      data: {
        status: 'succeeded',
        finishedAt: expect.any(Date),
        metadata: {
          sapoOrderId: 'sapo-order-1',
          action: 'created',
          pancakeOrderId: 'pancake-order-1',
        },
      },
    });
  });

  it('marks sync run as failed when Sapo order cannot be synced', async () => {
    const { processor, prisma, sapoClient } = createProcessor();
    sapoClient.fetchOrder.mockRejectedValueOnce(new Error('Sapo unavailable'));

    await expect(
      processor.process({
        data: { syncRunId: 'sync-run-1', sapoOrderId: 'sapo-order-1' },
      } as any),
    ).rejects.toThrow('Sapo unavailable');

    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-1' },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date),
        errorMessage: 'Sapo unavailable',
      },
    });
  });

  it('syncs paginated Sapo orders when payload does not contain a single order id', async () => {
    const { processor, prisma, sapoClient, orderSyncService } = createProcessor();
    sapoClient.fetchOrders
      .mockResolvedValueOnce({
        orders: [
          { id: 'sapo-order-1', status: 'draft' },
          { id: 'sapo-order-2', status: 'finalized' },
        ],
        metadata: { total: 3 },
      })
      .mockResolvedValueOnce({
        orders: [{ id: 'sapo-order-3', status: 'cancelled' }],
        metadata: { total: 3 },
      });
    orderSyncService.syncSapoOrder
      .mockResolvedValueOnce({
        action: 'created',
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
      })
      .mockResolvedValueOnce({
        action: 'updated',
        sapoOrderId: 'sapo-order-2',
        pancakeOrderId: 'pancake-order-2',
      })
      .mockResolvedValueOnce({
        action: 'skipped',
        sapoOrderId: 'sapo-order-3',
        pancakeOrderId: null,
      });

    await processor.process({ data: { syncRunId: 'sync-run-1' } } as any);

    expect(sapoClient.fetchOrders).toHaveBeenNthCalledWith(1, {
      page: 1,
      limit: 50,
    });
    expect(sapoClient.fetchOrders).toHaveBeenNthCalledWith(2, {
      page: 2,
      limit: 50,
    });
    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledTimes(3);
    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-1' },
      data: {
        status: 'succeeded',
        finishedAt: expect.any(Date),
        metadata: {
          processed: 3,
          created: 1,
          updated: 1,
          skipped: 1,
          results: [
            {
              action: 'created',
              sapoOrderId: 'sapo-order-1',
              pancakeOrderId: 'pancake-order-1',
            },
            {
              action: 'updated',
              sapoOrderId: 'sapo-order-2',
              pancakeOrderId: 'pancake-order-2',
            },
            {
              action: 'skipped',
              sapoOrderId: 'sapo-order-3',
              pancakeOrderId: null,
            },
          ],
        },
      },
    });
  });

  it('passes bulk filters to each Sapo order page fetch', async () => {
    const { processor, sapoClient } = createProcessor();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [],
      metadata: { total: 0 },
    });

    await processor.process({
      data: {
        syncRunId: 'sync-run-1',
        filters: {
          status: 'finalized',
          createdOnMin: '2026-05-01T00:00:00.000Z',
          createdOnMax: '2026-05-30T23:59:59.000Z',
          limit: 25,
        },
      },
    } as any);

    expect(sapoClient.fetchOrders).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      status: 'finalized',
      createdOnMin: '2026-05-01T00:00:00.000Z',
      createdOnMax: '2026-05-30T23:59:59.000Z',
    });
  });

  it('fetches each configured Sapo order status separately', async () => {
    const { processor, sapoClient, orderSyncService } = createProcessor();
    sapoClient.fetchOrders
      .mockResolvedValueOnce({
        orders: [{ id: 'sapo-order-finalized', status: 'finalized' }],
        metadata: { total: 1 },
      })
      .mockResolvedValueOnce({
        orders: [{ id: 'sapo-order-cancelled', status: 'cancelled' }],
        metadata: { total: 1 },
      });
    orderSyncService.syncSapoOrder
      .mockResolvedValueOnce({
        action: 'updated',
        sapoOrderId: 'sapo-order-finalized',
        pancakeOrderId: 'pancake-order-finalized',
      })
      .mockResolvedValueOnce({
        action: 'updated',
        sapoOrderId: 'sapo-order-cancelled',
        pancakeOrderId: 'pancake-order-cancelled',
      });

    await processor.process({
      data: {
        syncRunId: 'sync-run-1',
        filters: {
          statuses: ['finalized', 'cancelled'],
          limit: 5,
        },
      },
    } as any);

    expect(sapoClient.fetchOrders).toHaveBeenNthCalledWith(1, {
      page: 1,
      limit: 5,
      status: 'finalized',
      createdOnMin: undefined,
      createdOnMax: undefined,
    });
    expect(sapoClient.fetchOrders).toHaveBeenNthCalledWith(2, {
      page: 1,
      limit: 5,
      status: 'cancelled',
      createdOnMin: undefined,
      createdOnMax: undefined,
    });
    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledTimes(2);
  });

  it('treats bulk filter limit as the maximum orders processed per run', async () => {
    const { processor, sapoClient, orderSyncService } = createProcessor();
    sapoClient.fetchOrders.mockResolvedValueOnce({
      orders: [{ id: 'sapo-order-1' }, { id: 'sapo-order-2' }],
      metadata: { total: 100 },
    });
    orderSyncService.syncSapoOrder
      .mockResolvedValueOnce({
        action: 'updated',
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
      })
      .mockResolvedValueOnce({
        action: 'updated',
        sapoOrderId: 'sapo-order-2',
        pancakeOrderId: 'pancake-order-2',
      });

    await processor.process({
      data: {
        syncRunId: 'sync-run-1',
        filters: {
          limit: 2,
        },
      },
    } as any);

    expect(sapoClient.fetchOrders).toHaveBeenCalledTimes(1);
    expect(orderSyncService.syncSapoOrder).toHaveBeenCalledTimes(2);
  });

  it('dispatches top-order sync jobs to the top-order service', async () => {
    const { processor, prisma, topOrderSyncService } = createProcessor();

    await processor.process({
      data: {
        syncRunId: 'sync-run-1',
        mode: 'top-orders',
        topOrder: { orderType: 'PLACED', prefix: 'AUTO_PANCAKE', limit: 25 },
      },
    } as any);

    expect(topOrderSyncService.syncOrderType).toHaveBeenCalledWith({
      orderType: 'PLACED',
      prefix: 'AUTO_PANCAKE',
      limit: 25,
    });
    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-1' },
      data: {
        status: 'succeeded',
        finishedAt: expect.any(Date),
        metadata: {
          orderType: 'PLACED',
          prefix: 'AUTO_PANCAKE',
          fetched: 2,
          processed: 1,
          skippedTracked: 1,
          results: [],
        },
      },
    });
  });

  it('dispatches Sapo log sync jobs to the log service', async () => {
    const { processor, logSyncService } = createProcessor();

    await processor.process({
      data: { syncRunId: 'sync-run-1', mode: 'sapo-logs' },
    } as any);

    expect(logSyncService.syncRecentLogs).toHaveBeenCalledWith();
  });
});
