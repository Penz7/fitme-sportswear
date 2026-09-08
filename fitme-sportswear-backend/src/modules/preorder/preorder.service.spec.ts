import { PreorderService } from './preorder.service';

describe('PreorderService', () => {
  const service = new PreorderService({} as any);

  it('keeps normal sales available only after pending preorder debt is covered', () => {
    expect(
      service.evaluateAvailability({
        allowPreorder: true,
        preorderLimit: 10,
        preorderPendingQty: 10,
        sapoStock: 15,
      }),
    ).toEqual({
      availableForNewSale: 5,
      preorderRemainingQty: 0,
      mode: 'BUY_NOW',
    });
  });

  it('keeps an allowed SKU in preorder while stock is fully owed to older orders', () => {
    expect(
      service.evaluateAvailability({
        allowPreorder: true,
        preorderLimit: 20,
        preorderPendingQty: 10,
        sapoStock: 5,
      }),
    ).toEqual({
      availableForNewSale: -5,
      preorderRemainingQty: 10,
      mode: 'PREORDER',
    });
  });

  it('never enables preorder for a SKU outside the allowlist', () => {
    expect(
      service.evaluateAvailability({
        allowPreorder: false,
        preorderLimit: null,
        preorderPendingQty: 0,
        sapoStock: 0,
      }),
    ).toEqual({
      availableForNewSale: 0,
      preorderRemainingQty: null,
      mode: 'SOLD_OUT',
    });
  });

  it('exposes only the preorder capacity to Shopify while Sapo stock is zero', async () => {
    const prisma = {
      preorderSku: {
        findUnique: jest.fn().mockResolvedValue({
          allowPreorder: true,
          preorderLimit: 20,
        }),
      },
      preorderLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 3 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const configured = new PreorderService(prisma as any);

    await expect(configured.shopifyInventory('FM-ATSO02-XN-S', 0)).resolves.toEqual({
      managed: true,
      enabled: true,
      available: 17,
      inventoryPolicy: 'deny',
      mode: 'PREORDER',
      expectedRestockDate: null,
    });
  });

  it('releases only the physical surplus after older preorder debt', async () => {
    const prisma = {
      preorderSku: {
        findUnique: jest.fn().mockResolvedValue({
          allowPreorder: true,
          preorderLimit: 20,
        }),
      },
      preorderLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 10 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const configured = new PreorderService(prisma as any);

    await expect(configured.shopifyInventory('FM-ATSO02-XN-S', 15)).resolves.toEqual({
      managed: true,
      enabled: true,
      available: 5,
      inventoryPolicy: 'deny',
      mode: 'BUY_NOW',
      expectedRestockDate: null,
    });
  });

  it('keeps a disabled configured SKU stock-managed and clamps negative Sapo stock to zero', async () => {
    const prisma = {
      preorderSku: {
        findUnique: jest.fn().mockResolvedValue({ allowPreorder: false }),
      },
    };
    const configured = new PreorderService(prisma as any);

    await expect(configured.shopifyInventory('FM-ATSO02-XN-S', -1)).resolves.toEqual({
      managed: true,
      enabled: false,
      available: 0,
      inventoryPolicy: 'deny',
      mode: 'SOLD_OUT',
      expectedRestockDate: null,
    });
  });

  it('uses Shopify continue-selling only for an unlimited SKU that is actively preorder', async () => {
    const prisma = {
      preorderSku: {
        findUnique: jest.fn().mockResolvedValue({
          allowPreorder: true,
          preorderLimit: null,
        }),
      },
      preorderLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: 0, allocatedQty: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const configured = new PreorderService(prisma as any);

    await expect(configured.shopifyInventory('FM-ATCL01-HP-S', 0)).resolves.toEqual({
      managed: true,
      enabled: true,
      available: 0,
      inventoryPolicy: 'continue',
      mode: 'PREORDER',
      expectedRestockDate: null,
    });
  });

  it('allocates incoming stock to the earliest paid preorder lines first', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      preorderLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { allocatedQty: 0 } }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'oldest', quantity: 3, allocatedQty: 0 },
          { id: 'newer', quantity: 4, allocatedQty: 0 },
        ]),
        update,
      },
    };
    const configured = new PreorderService(prisma as any);

    await configured.allocateSapoStock('FM-ATSO02-XN-S', 5);

    expect(prisma.preorderLine.findMany).toHaveBeenCalledWith({
      where: {
        sku: 'FM-ATSO02-XN-S',
        paymentConfirmedAt: { not: null },
        status: { in: ['PENDING', 'ALLOCATED'] },
      },
      orderBy: [{ paymentConfirmedAt: 'asc' }, { createdAt: 'asc' }],
    });
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'oldest' },
      data: { allocatedQty: 3, status: 'READY_TO_FULFILL' },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'newer' },
      data: { allocatedQty: 2, status: 'ALLOCATED' },
    });
  });
});
