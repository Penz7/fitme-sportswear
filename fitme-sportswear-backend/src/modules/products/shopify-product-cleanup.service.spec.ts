import { ShopifyProductCleanupService } from './shopify-product-cleanup.service';

describe('ShopifyProductCleanupService', () => {
  function createService() {
    const prisma = {
      shopifyProduct: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'db-1', sku: 'SKU-1', productId: 'shopify-product-1' },
          { id: 'db-2', sku: 'SKU-2', productId: 'shopify-product-2' },
          { id: 'db-3', sku: 'SKU-3', productId: 'shopify-product-3' },
        ]),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const shopifyClient = {
      fetchProduct: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'shopify-product-1',
          images: [],
          tags: '',
        })
        .mockResolvedValueOnce({
          id: 'shopify-product-2',
          images: [{ id: 'image-1' }],
          tags: 'fitme',
        })
        .mockResolvedValueOnce(null),
      deleteProduct: jest.fn().mockResolvedValue(undefined),
    };

    return {
      prisma,
      shopifyClient,
      service: new ShopifyProductCleanupService(
        prisma as any,
        shopifyClient as any,
      ),
    };
  }

  it('deletes empty Shopify products and stale local rows', async () => {
    const { service, prisma, shopifyClient } = createService();

    const result = await service.cleanupEmptyProducts();

    expect(shopifyClient.deleteProduct).toHaveBeenCalledWith('shopify-product-1');
    expect(prisma.shopifyProduct.delete).toHaveBeenCalledWith({
      where: { id: 'db-1' },
    });
    expect(prisma.shopifyProduct.delete).toHaveBeenCalledWith({
      where: { id: 'db-3' },
    });
    expect(result).toEqual({
      checked: 3,
      deletedRemote: 1,
      deletedLocal: 2,
      kept: 1,
      errors: [],
    });
  });
});
