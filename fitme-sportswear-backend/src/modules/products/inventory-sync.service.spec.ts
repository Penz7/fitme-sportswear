import { InventorySyncService } from './inventory-sync.service';
import { ProductMappingCandidate } from './types/platform-product-snapshot';

function sapoOnlyMapping(): ProductMappingCandidate {
  return {
    sku: 'SKU-NEW',
    sapo: {
      platform: 'sapo',
      sku: 'SKU-NEW',
      productId: 'sapo-product-1',
      variantId: 'sapo-variant-1',
      name: 'New Shirt',
      available: 7,
      remain: 9,
      retailPrice: 150000,
      warehouseId: null,
      warehouseCount: null,
    },
    pancake: null,
    shopify: null,
    status: 'partial',
    conflictReason: 'Missing Pancake and Shopify records',
  };
}

describe('InventorySyncService missing product creation', () => {
  function createService(values: Record<string, unknown> = {}) {
    const prisma = {
      pancakeProduct: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      shopifyProduct: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      productMapping: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const pancakeClient = {
      createProductFromSapo: jest.fn().mockResolvedValue({
        productId: 'pancake-product-1',
        variantId: 'pancake-variant-1',
        warehouseId: 'warehouse-1',
      }),
      updateInventory: jest.fn().mockResolvedValue(undefined),
    };
    const shopifyClient = {
      createProductFromSapo: jest.fn().mockResolvedValue({
        productId: 'shopify-product-1',
        variantId: 'shopify-variant-1',
      }),
      updateInventoryAndPrice: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn((key: string) => values[key]),
    };

    return {
      prisma,
      pancakeClient,
      shopifyClient,
      service: new InventorySyncService(
        prisma as any,
        pancakeClient as any,
        shopifyClient as any,
        configService as any,
      ),
    };
  }

  it('creates missing Pancake products from Sapo by default and stores mapping', async () => {
    const { service, pancakeClient, prisma } = createService();

    const result = await service.syncMappings([sapoOnlyMapping()]);

    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith({
      sku: 'SKU-NEW',
      name: 'New Shirt',
      available: 7,
      retailPrice: 150000,
    });
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'pancake-variant-1',
      warehouseId: 'warehouse-1',
      available: 7,
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
        sapoProductId: 'sapo-product-1',
        pancakeProductId: 'pancake-product-1',
        pancakeVariantId: 'pancake-variant-1',
        pancakeWarehouseId: 'warehouse-1',
      }),
      update: expect.objectContaining({
        pancakeProductId: 'pancake-product-1',
        pancakeVariantId: 'pancake-variant-1',
        pancakeWarehouseId: 'warehouse-1',
      }),
    });
    expect(result.createdPancake).toBe(1);
  });

  it('creates missing Shopify products only when enabled', async () => {
    const { service, shopifyClient, prisma } = createService({
      'sync.products.createMissingShopify': true,
    });

    const result = await service.syncMappings([sapoOnlyMapping()]);

    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledWith({
      sku: 'SKU-NEW',
      name: 'New Shirt',
      available: 7,
      retailPrice: 150000,
    });
    expect(prisma.shopifyProduct.upsert).toHaveBeenCalled();
    expect(result.createdShopify).toBe(1);
  });
});
