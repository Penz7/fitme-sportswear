import { ShopifyOrderReconciliationService } from './shopify-order-reconciliation.service';

describe('ShopifyOrderReconciliationService', () => {
  it('cancels mapped Sapo orders when Shopify order is cancelled', async () => {
    const prisma = {
      orderMapping: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'mapping-1',
              shopifyOrderId: 'shopify-order-1',
              sapoOrderId: 'sapo-order-1',
              sapoStatus: 'finalized',
            },
          ])
          .mockResolvedValueOnce([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const shopifyClient = {
      fetchRecentOrders: jest.fn().mockResolvedValue([
        {
          id: 'shopify-order-1',
          cancelled_at: '2026-06-16T16:25:59+07:00',
        },
      ]),
      fetchOrder: jest.fn(),
    };
    const sapoClient = {
      cancelOrder: jest.fn().mockResolvedValue({}),
    };
    const service = new ShopifyOrderReconciliationService(
      prisma as any,
      shopifyClient as any,
      sapoClient as any,
    );

    await expect(service.reconcile({ limit: 10 })).resolves.toEqual({
      checked: 1,
      cancelledSapo: 1,
      expiredUnpaidPreorders: 0,
      activatedPreorders: 0,
      skipped: 0,
      errors: [],
    });

    expect(prisma.orderMapping.findMany).toHaveBeenCalledWith({
      where: {
        shopifyOrderId: { in: ['shopify-order-1'] },
        sapoOrderId: { not: null },
      },
    });
    expect(prisma.orderMapping.findMany).toHaveBeenCalledWith({
      where: {
        shopifyOrderId: { not: null },
        sapoOrderId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    expect(shopifyClient.fetchRecentOrders).toHaveBeenCalledWith({
      limit: 50,
      status: 'any',
    });
    expect(shopifyClient.fetchOrder).not.toHaveBeenCalled();
    expect(sapoClient.cancelOrder).toHaveBeenCalledWith('sapo-order-1', {
      tolerateIdempotent422: true,
    });
    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-1' },
      data: {
        shopifyStatus: 'CANCELLED',
        sapoStatus: 'cancelled',
      },
    });
  });

  it('checks recently updated Shopify orders even when their mappings are older', async () => {
    const prisma = {
      orderMapping: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'mapping-older',
              shopifyOrderId: 'shopify-order-older',
              sapoOrderId: 'sapo-order-older',
              sapoStatus: 'finalized',
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'mapping-newer',
              shopifyOrderId: 'shopify-order-newer',
              sapoOrderId: 'sapo-order-newer',
              sapoStatus: 'finalized',
            },
          ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const shopifyClient = {
      fetchRecentOrders: jest.fn().mockResolvedValue([
        {
          id: 'shopify-order-older',
          cancelled_at: '2026-08-05T10:51:58+07:00',
        },
      ]),
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'shopify-order-newer',
      }),
    };
    const sapoClient = {
      cancelOrder: jest.fn().mockResolvedValue({}),
    };
    const service = new ShopifyOrderReconciliationService(
      prisma as any,
      shopifyClient as any,
      sapoClient as any,
    );

    await expect(service.reconcile({ limit: 10 })).resolves.toEqual({
      checked: 2,
      cancelledSapo: 1,
      expiredUnpaidPreorders: 0,
      activatedPreorders: 0,
      skipped: 1,
      errors: [],
    });

    expect(sapoClient.cancelOrder).toHaveBeenCalledWith('sapo-order-older', {
      tolerateIdempotent422: true,
    });
    expect(prisma.orderMapping.update).toHaveBeenCalledWith({
      where: { id: 'mapping-older' },
      data: {
        shopifyStatus: 'CANCELLED',
        sapoStatus: 'cancelled',
      },
    });
  });

  it('promotes a pending preorder only when Shopify now reports paid', async () => {
    const prisma = {
      orderMapping: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'pending-mapping-1',
              shopifyOrderId: 'shopify-preorder-1',
              sapoOrderId: null,
              shopifyStatus: 'PREORDER_PENDING_PAYMENT',
            },
          ]),
      },
    };
    const shopifyClient = {
      fetchRecentOrders: jest.fn().mockResolvedValue([]),
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'shopify-preorder-1',
        financial_status: 'paid',
      }),
    };
    const processing = {
      buildProcessingPlan: jest.fn().mockReturnValue({ nextActions: ['create_sapo_order_if_missing'] }),
    };
    const execution = { executePlan: jest.fn().mockResolvedValue(undefined) };
    const service = new ShopifyOrderReconciliationService(
      prisma as any,
      shopifyClient as any,
      {} as any,
      processing as any,
      execution as any,
    );

    await expect(service.reconcile({ limit: 10 })).resolves.toEqual({
      checked: 1,
      cancelledSapo: 0,
      expiredUnpaidPreorders: 0,
      activatedPreorders: 1,
      skipped: 0,
      errors: [],
    });
    expect(processing.buildProcessingPlan).toHaveBeenCalledWith({
      sourcePlatform: 'shopify',
      eventType: 'orders/updated',
      externalEventId: 'shopify-preorder-1',
      payload: { id: 'shopify-preorder-1', financial_status: 'paid' },
    });
    expect(execution.executePlan).toHaveBeenCalledWith(
      { nextActions: ['create_sapo_order_if_missing'] },
      { id: 'shopify-preorder-1', financial_status: 'paid' },
    );
  });

  it('expires an unpaid preorder after 45 minutes without creating a Sapo order', async () => {
    const prisma = {
      orderMapping: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'pending-mapping-45-minutes',
              shopifyOrderId: 'shopify-preorder-expired-1',
              sapoOrderId: null,
              shopifyStatus: 'PREORDER_PENDING_PAYMENT',
            },
          ]),
      },
    };
    const shopifyClient = {
      fetchRecentOrders: jest.fn().mockResolvedValue([]),
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'shopify-preorder-expired-1',
        financial_status: 'pending',
        fulfillment_status: null,
        created_at: new Date(Date.now() - 46 * 60 * 1000).toISOString(),
      }),
      cancelOrder: jest.fn().mockResolvedValue(undefined),
    };
    const processing = {
      buildProcessingPlan: jest.fn().mockReturnValue({
        statusDescription: 'SHOPIFY_CANCELLED',
        nextActions: ['cancel_sapo_order', 'upsert_order_mapping'],
      }),
    };
    const execution = { executePlan: jest.fn().mockResolvedValue(undefined) };
    const service = new ShopifyOrderReconciliationService(
      prisma as any,
      shopifyClient as any,
      {} as any,
      processing as any,
      execution as any,
    );

    await expect(service.reconcile({ limit: 10 })).resolves.toEqual({
      checked: 1,
      cancelledSapo: 0,
      expiredUnpaidPreorders: 1,
      activatedPreorders: 0,
      skipped: 0,
      errors: [],
    });
    expect(shopifyClient.cancelOrder).toHaveBeenCalledWith(
      'shopify-preorder-expired-1',
      'other',
    );
    expect(execution.executePlan).toHaveBeenCalledWith(
      expect.objectContaining({ statusDescription: 'SHOPIFY_CANCELLED' }),
      expect.objectContaining({ cancel_reason: 'other' }),
    );
  });
});
