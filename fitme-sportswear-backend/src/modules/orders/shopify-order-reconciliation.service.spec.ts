import { ShopifyOrderReconciliationService } from './shopify-order-reconciliation.service';

describe('ShopifyOrderReconciliationService', () => {
  it('cancels mapped Sapo orders when Shopify order is cancelled', async () => {
    const prisma = {
      orderMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mapping-1',
            shopifyOrderId: 'shopify-order-1',
            sapoOrderId: 'sapo-order-1',
            sapoStatus: 'finalized',
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const shopifyClient = {
      fetchOrder: jest.fn().mockResolvedValue({
        id: 'shopify-order-1',
        cancelled_at: '2026-06-16T16:25:59+07:00',
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
      checked: 1,
      cancelledSapo: 1,
      skipped: 0,
      errors: [],
    });

    expect(prisma.orderMapping.findMany).toHaveBeenCalledWith({
      where: {
        shopifyOrderId: { not: null },
        sapoOrderId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
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
});
