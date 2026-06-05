import { ProductSnapshotService } from './product-snapshot.service';

describe('ProductSnapshotService', () => {
  function createPrismaMock() {
    return {
      sapoProduct: { upsert: jest.fn().mockResolvedValue({}) },
      pancakeProduct: { upsert: jest.fn().mockResolvedValue({}) },
      shopifyProduct: { upsert: jest.fn().mockResolvedValue({}) },
    };
  }

  it('returns duplicate Sapo snapshots without upserting duplicate SKUs', async () => {
    const prisma = createPrismaMock();
    const sapoClient = {
      fetchProducts: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Product 1',
          variants: [{ id: 11, sku: 'DUP-SKU', inventories: [] }],
        },
        {
          id: 2,
          name: 'Product 2',
          variants: [{ id: 22, sku: 'DUP-SKU', inventories: [] }],
        },
      ]),
    };

    const service = new ProductSnapshotService(
      prisma as any,
      sapoClient as any,
      { fetchProducts: jest.fn() } as any,
      { fetchProducts: jest.fn() } as any,
    );

    const snapshots = await service.refreshSapoSnapshots();

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.sku)).toEqual([
      'DUP-SKU',
      'DUP-SKU',
    ]);
    expect(prisma.sapoProduct.upsert).not.toHaveBeenCalled();
  });

  it('persists snapshots from real client contract-shaped responses', async () => {
    const prisma = createPrismaMock();
    const sapoClient = {
      fetchProducts: jest.fn().mockResolvedValue([
        {
          id: 'sapo-product-1',
          name: 'Sapo shirt',
          variants: [
            {
              id: 'sapo-variant-1',
              sku: 'SKU-REAL-1',
              variantRetailPrice: 100000,
              updated_at: '2026-06-01T10:00:00.000Z',
              inventories: [{ available: 5, onHand: 6 }],
            },
          ],
        },
      ]),
    };
    const pancakeClient = {
      fetchProducts: jest.fn().mockResolvedValue([
        {
          id: 'pancake-variant-1',
          productId: 'pancake-product-1',
          displayId: 'SKU-REAL-1',
          product: { name: 'Pancake shirt' },
          retailPrice: 100000,
          variationsWarehouses: [
            {
              warehouseId: 'warehouse-1',
              remainQuantity: 5,
              actualRemainQuantity: 6,
            },
          ],
        },
      ]),
    };
    const shopifyClient = {
      fetchProducts: jest.fn().mockResolvedValue([
        {
          id: 'shopify-product-1',
          title: 'Shopify shirt',
          variants: [
            {
              id: 'shopify-variant-1',
              sku: 'SKU-REAL-1',
              title: 'Default Title',
              available: 5,
              inventoryQuantity: 6,
              price: 100000,
            },
          ],
        },
      ]),
    };
    const service = new ProductSnapshotService(
      prisma as any,
      sapoClient as any,
      pancakeClient as any,
      shopifyClient as any,
    );

    const snapshots = await service.refreshAllSnapshots();

    expect(snapshots.map((snapshot) => snapshot.platform)).toEqual([
      'sapo',
      'pancake',
      'shopify',
    ]);
    expect(snapshots.every((snapshot) => snapshot.sku === 'SKU-REAL-1')).toBe(
      true,
    );
    expect(prisma.sapoProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-REAL-1' },
      create: expect.objectContaining({
        sourceUpdatedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
      update: expect.objectContaining({
        sourceUpdatedAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.shopifyProduct.upsert).toHaveBeenCalledTimes(1);
  });

  it('refreshes only Sapo and Pancake snapshots for Phase 4 preflight mappings', async () => {
    const prisma = createPrismaMock();
    const sapoClient = {
      fetchProducts: jest.fn().mockResolvedValue([]),
    };
    const pancakeClient = {
      fetchProducts: jest.fn().mockResolvedValue([]),
    };
    const shopifyClient = {
      fetchProducts: jest.fn(),
    };
    const service = new ProductSnapshotService(
      prisma as any,
      sapoClient as any,
      pancakeClient as any,
      shopifyClient as any,
    );

    await expect(service.refreshPancakeToSapoSnapshots()).resolves.toEqual([]);

    expect(sapoClient.fetchProducts).toHaveBeenCalledTimes(1);
    expect(pancakeClient.fetchProducts).toHaveBeenCalledTimes(1);
    expect(shopifyClient.fetchProducts).not.toHaveBeenCalled();
  });
});
