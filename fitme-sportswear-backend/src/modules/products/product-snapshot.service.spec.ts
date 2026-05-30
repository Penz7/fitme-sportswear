import { ProductSnapshotService } from './product-snapshot.service';

describe('ProductSnapshotService', () => {
  it('returns duplicate Sapo snapshots without upserting duplicate SKUs', async () => {
    const prisma = {
      sapoProduct: { upsert: jest.fn().mockResolvedValue({}) },
      pancakeProduct: { upsert: jest.fn().mockResolvedValue({}) },
      shopifyProduct: { upsert: jest.fn().mockResolvedValue({}) },
    };
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
});
