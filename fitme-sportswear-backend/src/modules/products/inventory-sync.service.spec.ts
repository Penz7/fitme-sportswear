import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMappingCandidate } from './types/platform-product-snapshot';

function sapoOnlyMapping(overrides: Partial<ProductMappingCandidate> = {}): ProductMappingCandidate {
  const sku = overrides.sku ?? 'SKU-NEW';
  return {
    sku,
    normalizedSku: overrides.normalizedSku ?? sku.trim().toUpperCase(),
    sapo: sapoSnapshot(sku),
    pancake: null,
    shopify: null,
    status: 'partial',
    conflictReason: 'Missing Pancake and Shopify records',
    conflictDetail: null,
    ...overrides,
  };
}

function sapoSnapshot(sku: string, overrides: Record<string, any> = {}) {
  return {
    platform: 'sapo' as const,
    sku,
    normalizedSku: sku.trim().toUpperCase(),
    productId: 'sapo-product-1',
    variantId: 'sapo-variant-1',
    name: 'New Shirt',
    available: 7,
    remain: 9,
    retailPrice: 150000,
    warehouseId: null,
    warehouseCount: null,
    ...overrides,
  };
}

function targetSnapshot(platform: 'pancake' | 'shopify', sku: string, overrides: Record<string, any> = {}) {
  return {
    platform,
    sku,
    normalizedSku: sku.trim().toUpperCase(),
    productId: `${platform}-product-1`,
    variantId: `${platform}-variant-1`,
    name: 'New Shirt',
    available: 7,
    remain: 9,
    retailPrice: 150000,
    warehouseId: platform === 'pancake' ? 'warehouse-1' : null,
    warehouseCount: platform === 'pancake' ? 1 : null,
    ...overrides,
  };
}

describe('InventorySyncService missing product creation', () => {
  function createService(values: Record<string, unknown> = {}) {
    const prisma = {
      pancakeProduct: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      shopifyProduct: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      productMapping: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
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
    const notifier = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    return {
      prisma,
      pancakeClient,
      shopifyClient,
      notifier,
      service: new InventorySyncService(
        prisma as any,
        pancakeClient as any,
        shopifyClient as any,
        configService as any,
        notifier as any,
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

  it('does not create missing combo SKU on Pancake when missing product creation is enabled', async () => {
    const { service, pancakeClient } = createService({
      'sync.products.createMissingPancake': true,
    });

    const result = await service.syncMappings([
      sapoOnlyMapping({
        sku: 'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
        normalizedSku: 'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
      }),
    ]);

    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(result.createdPancake).toBe(0);
  });

  it('does not create missing combo SKU on Shopify when missing product creation is enabled', async () => {
    const { service, pancakeClient, shopifyClient } = createService({
      'sync.products.createMissingPancake': true,
      'sync.products.createMissingShopify': true,
    });
    const comboSku = 'FM-ATSO01-DO-L-FM-VSFM01-TR-L';

    const result = await service.syncMappings([
      sapoOnlyMapping({
        sku: comboSku,
        normalizedSku: comboSku,
        sapo: sapoSnapshot(comboSku, { sourceUpdatedAt: new Date() }),
      }),
    ]);

    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(shopifyClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(shopifyClient.updateInventoryAndPrice).not.toHaveBeenCalled();
    expect(result.createdPancake).toBe(0);
    expect(result.createdShopify).toBe(0);
    expect(result.createdShopifySkus).toEqual([]);
  });

  it('does not create missing Pancake products when SKU is blocklisted', async () => {
    const { service, pancakeClient } = createService({
      'sync.products.createMissingPancake': true,
      'sync.products.skuBlocklist': ['SKU-SKIP'],
    });

    const result = await service.syncMappings([
      sapoOnlyMapping({ sku: 'SKU-NEW', normalizedSku: 'SKU-NEW' }),
      sapoOnlyMapping({ sku: 'SKU-SKIP', normalizedSku: 'SKU-SKIP' }),
    ]);

    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledTimes(1);
    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith({
      sku: 'SKU-NEW',
      name: 'New Shirt',
      available: 7,
      retailPrice: 150000,
    });
    expect(result.createdPancake).toBe(1);
  });

  it('does not update existing Pancake products when SKU is blocklisted', async () => {
    const { service, pancakeClient, prisma } = createService({
      'sync.products.skuBlocklist': ['SKU-NEW'],
    });

    const result = await service.syncMappings([
      {
        ...sapoOnlyMapping(),
        pancake: targetSnapshot('pancake', 'SKU-NEW', {
          available: 1,
          remain: 1,
        }),
      },
    ]);

    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(prisma.pancakeProduct.update).not.toHaveBeenCalled();
    expect(result.updatedPancake).toBe(0);
    expect(result.createdPancake).toBe(0);
  });

  it('loads product sync SKU blocklist from JSON file', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fitme-blocklist-'));
    const blocklistFile = join(tempDir, 'product-sync-sku-blocklist.json');
    writeFileSync(
      blocklistFile,
      JSON.stringify({ blockedSkus: ['SKU-SKIP'] }),
      'utf8',
    );

    try {
      const { service, pancakeClient } = createService({
        'sync.products.createMissingPancake': true,
        'sync.products.skuBlocklistFile': blocklistFile,
      });

      const result = await service.syncMappings([
        sapoOnlyMapping({ sku: 'SKU-NEW', normalizedSku: 'SKU-NEW' }),
        sapoOnlyMapping({ sku: 'SKU-SKIP', normalizedSku: 'SKU-SKIP' }),
      ]);

      expect(pancakeClient.createProductFromSapo).toHaveBeenCalledTimes(1);
      expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith({
        sku: 'SKU-NEW',
        name: 'New Shirt',
        available: 7,
        retailPrice: 150000,
      });
      expect(result.createdPancake).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('updates existing Pancake product instead of creating when Sapo-only mapping now has Pancake snapshot', async () => {
    const { service, pancakeClient, prisma } = createService();
    prisma.pancakeProduct.findUnique.mockResolvedValueOnce({
      sku: 'SKU-NEW',
      productId: 'existing-pancake-product',
      variantId: 'existing-pancake-variant',
      warehouseId: 'existing-warehouse',
      available: 3,
    });

    const result = await service.syncMappings([sapoOnlyMapping()]);

    expect(prisma.pancakeProduct.findUnique).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
    });
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'existing-pancake-variant',
      warehouseId: 'existing-warehouse',
      available: 7,
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
        productId: 'existing-pancake-product',
        variantId: 'existing-pancake-variant',
        available: 7,
        retailPrice: 150000,
        updatedBy: 'SAPO',
      }),
      update: expect.objectContaining({
        productId: 'existing-pancake-product',
        variantId: 'existing-pancake-variant',
        available: 7,
        retailPrice: 150000,
        updatedBy: 'SAPO',
      }),
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
        sapoProductId: 'sapo-product-1',
        pancakeProductId: 'existing-pancake-product',
        pancakeVariantId: 'existing-pancake-variant',
        pancakeWarehouseId: 'existing-warehouse',
      }),
      update: expect.objectContaining({
        pancakeProductId: 'existing-pancake-product',
        pancakeVariantId: 'existing-pancake-variant',
        pancakeWarehouseId: 'existing-warehouse',
      }),
    });
    expect(result.updatedPancake).toBe(1);
    expect(result.createdPancake).toBe(0);
  });

  it('uses normalized SKU lookup before creating a Pancake product', async () => {
    const { service, pancakeClient, prisma } = createService();
    const mapping = {
      ...sapoOnlyMapping(),
      sku: ' sku-new ',
      normalizedSku: 'SKU-NEW',
      sapo: sapoSnapshot(' sku-new '),
    };
    prisma.pancakeProduct.findMany.mockResolvedValueOnce([
      {
        sku: 'SKU-NEW',
        productId: 'existing-pancake-product',
        variantId: 'existing-pancake-variant',
        warehouseId: 'existing-warehouse',
        available: 3,
      },
    ]);

    const result = await service.syncMappings([mapping]);

    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'existing-pancake-variant',
      warehouseId: 'existing-warehouse',
      available: 7,
    });
    expect(result.updatedPancake).toBe(1);
    expect(result.createdPancake).toBe(0);
  });

  it('uses normalized product mapping lookup before creating a Pancake product', async () => {
    const { service, pancakeClient, prisma } = createService();
    const mapping = {
      ...sapoOnlyMapping(),
      sku: ' sku-new ',
      normalizedSku: 'SKU-NEW',
      sapo: sapoSnapshot(' sku-new '),
    };
    prisma.productMapping.findMany.mockResolvedValueOnce([
      {
        sku: 'SKU-NEW',
        pancakeProductId: 'mapped-pancake-product',
        pancakeVariantId: 'mapped-pancake-variant',
        pancakeWarehouseId: 'mapped-warehouse',
      },
    ]);

    const result = await service.syncMappings([mapping]);

    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'mapped-pancake-variant',
      warehouseId: 'mapped-warehouse',
      available: 7,
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledWith({
      where: { sku: ' sku-new ' },
      create: expect.objectContaining({
        productId: 'mapped-pancake-product',
        variantId: 'mapped-pancake-variant',
      }),
      update: expect.objectContaining({
        productId: 'mapped-pancake-product',
        variantId: 'mapped-pancake-variant',
      }),
    });
    expect(result.updatedPancake).toBe(1);
    expect(result.createdPancake).toBe(0);
  });

  it('does not create or update Pancake for conflict mappings', async () => {
    const { service, pancakeClient, prisma } = createService();
    const conflictMapping: ProductMappingCandidate = {
      ...sapoOnlyMapping(),
      status: 'conflict',
      conflictReason: 'duplicate_pancake_sku',
      conflictDetail: {
        type: 'duplicate_pancake_sku',
        platform: 'pancake',
        message: 'Duplicate Pancake SKU',
        sapoVariantCount: 1,
        pancakeVariantCount: 2,
        shopifyVariantCount: 0,
        entries: [],
      },
    };

    const result = await service.syncMappings([conflictMapping]);

    expect(prisma.pancakeProduct.findUnique).not.toHaveBeenCalled();
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(prisma.pancakeProduct.update).not.toHaveBeenCalled();
    expect(prisma.pancakeProduct.upsert).not.toHaveBeenCalled();
    expect(prisma.productMapping.upsert).not.toHaveBeenCalled();
    expect(result.updatedPancake).toBe(0);
    expect(result.createdPancake).toBe(0);
  });

  it('uses configured Pancake warehouse fallback when create response has no warehouse', async () => {
    const { service, pancakeClient, prisma } = createService({
      'pancake.defaultWarehouseId': 'fallback-warehouse',
    });
    pancakeClient.createProductFromSapo.mockResolvedValueOnce({
      productId: 'pancake-product-1',
      variantId: 'pancake-variant-1',
      warehouseId: null,
    });

    const result = await service.syncMappings([sapoOnlyMapping()]);

    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'pancake-variant-1',
      warehouseId: 'fallback-warehouse',
      available: 7,
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({ pancakeWarehouseId: 'fallback-warehouse' }),
      update: expect.objectContaining({ pancakeWarehouseId: 'fallback-warehouse' }),
    });
    expect(result.createdPancake).toBe(1);
  });

  it('persists created Pancake IDs when inventory update fails after create', async () => {
    const { service, pancakeClient, prisma } = createService();
    pancakeClient.updateInventory.mockRejectedValueOnce(
      new Error('Pancake inventory failed'),
    );

    const result = await service.syncMappings([sapoOnlyMapping()]);

    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledTimes(1);
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
        productId: 'pancake-product-1',
        variantId: 'pancake-variant-1',
        name: 'New Shirt',
        available: 7,
        remain: 9,
        retailPrice: 150000,
        warehouseId: 'warehouse-1',
        updatedBy: 'SAPO',
      }),
      update: expect.objectContaining({
        productId: 'pancake-product-1',
        variantId: 'pancake-variant-1',
        available: 7,
        remain: 9,
        warehouseId: 'warehouse-1',
        updatedBy: 'SAPO',
      }),
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
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
    expect(result.createdPancake).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        sku: 'SKU-NEW',
        platform: 'pancake',
        operation: 'createProductFromSapo',
        message: 'Pancake inventory failed',
      }),
    ]);
  });

  it('skips unchanged external inventory updates shortly after Sapo changed', async () => {
    const { service, pancakeClient, shopifyClient } = createService();
    const sourceUpdatedAt = new Date();

    const result = await service.syncMappings([
      {
        sku: 'SKU-SAME',
        normalizedSku: 'SKU-SAME',
        sapo: sapoSnapshot('SKU-SAME', { sourceUpdatedAt }),
        pancake: targetSnapshot('pancake', 'SKU-SAME'),
        shopify: targetSnapshot('shopify', 'SKU-SAME'),
        status: 'matched',
        conflictReason: null,
        conflictDetail: null,
      },
    ]);

    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(shopifyClient.updateInventoryAndPrice).not.toHaveBeenCalled();
    expect(result.updatedPancake).toBe(0);
    expect(result.updatedShopify).toBe(0);
  });

  it('creates missing Shopify products as plain SKU products when enabled', async () => {
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

  it('sends Shopify inventory progress with remaining count and sample SKUs', async () => {
    const { service, notifier } = createService({
      'sync.shopifyProgressInterval': 1,
    });

    const result = await service.syncMappings(
      [
        {
          ...sapoOnlyMapping({ sku: 'SKU-1', normalizedSku: 'SKU-1' }),
          shopify: targetSnapshot('shopify', 'SKU-1', { available: 1 }),
          status: 'matched',
          conflictReason: null,
        },
        {
          ...sapoOnlyMapping({ sku: 'SKU-2', normalizedSku: 'SKU-2' }),
          shopify: targetSnapshot('shopify', 'SKU-2', { available: 2 }),
          status: 'matched',
          conflictReason: null,
        },
      ],
      { syncRunId: 'sync-run-1' },
    );

    expect(result.updatedShopify).toBe(2);
    expect(result.updatedShopifySkus).toEqual(['SKU-1', 'SKU-2']);
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Shopify inventory sync progress: sync-run-1',
      expect.stringContaining('processedShopify=1'),
    );
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Shopify inventory sync progress: sync-run-1',
      expect.stringContaining('remainingShopify=0'),
    );
    expect(notifier.sendMessage.mock.calls[0][1]).toContain(
      'updatedShopifySkusSample=SKU-1',
    );
    expect(notifier.sendMessage.mock.calls[1][1]).toContain(
      'updatedShopifySkusSample=SKU-2',
    );
  });

  it('processes hot Shopify inventory candidates before backlog candidates', async () => {
    const { service, shopifyClient } = createService({
      'sync.shopifyInventoryHotWindowMinutes': 30,
    });
    const now = Date.now();

    await service.syncMappings([
      {
        ...sapoOnlyMapping({ sku: 'SKU-BACKLOG', normalizedSku: 'SKU-BACKLOG' }),
        sapo: sapoSnapshot('SKU-BACKLOG', {
          sourceUpdatedAt: new Date(now - 2 * 60 * 60000),
        }),
        shopify: targetSnapshot('shopify', 'SKU-BACKLOG', {
          available: 1,
          variantId: 'shopify-variant-backlog',
        }),
        status: 'matched',
        conflictReason: null,
      },
      {
        ...sapoOnlyMapping({ sku: 'SKU-HOT', normalizedSku: 'SKU-HOT' }),
        sapo: sapoSnapshot('SKU-HOT', {
          sourceUpdatedAt: new Date(now - 5 * 60000),
        }),
        shopify: targetSnapshot('shopify', 'SKU-HOT', {
          available: 1,
          variantId: 'shopify-variant-hot',
        }),
        status: 'matched',
        conflictReason: null,
      },
    ]);

    expect(shopifyClient.updateInventoryAndPrice).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ variantId: 'shopify-variant-hot' }),
    );
    expect(shopifyClient.updateInventoryAndPrice).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ variantId: 'shopify-variant-backlog' }),
    );
  });

  it('reports Shopify hot and backlog candidate counts in progress notifications', async () => {
    const { service, notifier } = createService({
      'sync.shopifyProgressInterval': 1,
      'sync.shopifyInventoryHotWindowMinutes': 30,
    });
    const now = Date.now();

    await service.syncMappings(
      [
        {
          ...sapoOnlyMapping({ sku: 'SKU-BACKLOG', normalizedSku: 'SKU-BACKLOG' }),
          sapo: sapoSnapshot('SKU-BACKLOG', {
            sourceUpdatedAt: new Date(now - 2 * 60 * 60000),
          }),
          shopify: targetSnapshot('shopify', 'SKU-BACKLOG', {
            available: 1,
            variantId: 'shopify-variant-backlog',
          }),
          status: 'matched',
          conflictReason: null,
        },
        {
          ...sapoOnlyMapping({ sku: 'SKU-HOT', normalizedSku: 'SKU-HOT' }),
          sapo: sapoSnapshot('SKU-HOT', {
            sourceUpdatedAt: new Date(now - 5 * 60000),
          }),
          shopify: targetSnapshot('shopify', 'SKU-HOT', {
            available: 1,
            variantId: 'shopify-variant-hot',
          }),
          status: 'matched',
          conflictReason: null,
        },
      ],
      { syncRunId: 'sync-run-1' },
    );

    expect(notifier.sendMessage.mock.calls[0][1]).toContain(
      'hotShopifyCandidates=1',
    );
    expect(notifier.sendMessage.mock.calls[0][1]).toContain(
      'backlogShopifyCandidates=1',
    );
  });

  it('creates old missing Shopify products when creation is enabled', async () => {
    const { service, shopifyClient } = createService({
      'sync.products.createMissingShopify': true,
      'sync.products.createMissingShopifyWindowMinutes': 60,
    });

    const result = await service.syncMappings([
      sapoOnlyMapping({
        sku: 'SKU-OLD',
        normalizedSku: 'SKU-OLD',
        sapo: sapoSnapshot('SKU-OLD', {
          sourceUpdatedAt: new Date(Date.now() - 2 * 60 * 60000),
        }),
      }),
    ]);

    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledWith({
      sku: 'SKU-OLD',
      name: 'New Shirt',
      available: 7,
      retailPrice: 150000,
    });
    expect(result.createdShopify).toBe(1);
  });

  it('limits missing Shopify product creation per run', async () => {
    const { service, shopifyClient } = createService({
      'sync.products.createMissingShopify': true,
      'sync.products.createMissingShopifyMaxPerRun': 1,
    });

    const result = await service.syncMappings([
      sapoOnlyMapping({
        sku: 'SKU-NEW-1',
        normalizedSku: 'SKU-NEW-1',
        sapo: sapoSnapshot('SKU-NEW-1', { sourceUpdatedAt: new Date() }),
      }),
      sapoOnlyMapping({
        sku: 'SKU-NEW-2',
        normalizedSku: 'SKU-NEW-2',
        sapo: sapoSnapshot('SKU-NEW-2', { sourceUpdatedAt: new Date() }),
      }),
    ]);

    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledTimes(1);
    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'SKU-NEW-1' }),
    );
    expect(result.createdShopify).toBe(1);
  });

  it('creates only allowlisted missing Shopify products when an allowlist is configured', async () => {
    const { service, shopifyClient } = createService({
      'sync.products.createMissingShopify': true,
      'sync.products.createMissingShopifySkuAllowlist': ['SKU-NEW-2'],
    });

    const result = await service.syncMappings([
      sapoOnlyMapping({
        sku: 'SKU-NEW-1',
        normalizedSku: 'SKU-NEW-1',
      }),
      sapoOnlyMapping({
        sku: 'SKU-NEW-2',
        normalizedSku: 'SKU-NEW-2',
      }),
    ]);

    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledTimes(1);
    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'SKU-NEW-2' }),
    );
    expect(result.createdShopify).toBe(1);
  });

  it('persists created Shopify IDs when inventory and price update fails after create', async () => {
    const { service, shopifyClient, prisma } = createService({
      'sync.products.createMissingShopify': true,
    });
    shopifyClient.updateInventoryAndPrice.mockRejectedValueOnce(
      new Error('Shopify inventory failed'),
    );

    const result = await service.syncMappings([
      sapoOnlyMapping({
        sapo: sapoSnapshot('SKU-NEW', { sourceUpdatedAt: new Date() }),
      }),
    ]);

    expect(shopifyClient.createProductFromSapo).toHaveBeenCalledTimes(1);
    expect(prisma.shopifyProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
        productId: 'shopify-product-1',
        variantId: 'shopify-variant-1',
        name: 'New Shirt',
        available: BigInt(7),
        remain: BigInt(9),
        retailPrice: 150000,
        updatedBy: 'SAPO',
      }),
      update: expect.objectContaining({
        productId: 'shopify-product-1',
        variantId: 'shopify-variant-1',
        available: BigInt(7),
        remain: BigInt(9),
        updatedBy: 'SAPO',
      }),
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        sku: 'SKU-NEW',
        shopifyProductId: 'shopify-product-1',
        shopifyVariantId: 'shopify-variant-1',
      }),
      update: expect.objectContaining({
        shopifyProductId: 'shopify-product-1',
        shopifyVariantId: 'shopify-variant-1',
      }),
    });
    expect(result.createdShopify).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({
        sku: 'SKU-NEW',
        platform: 'shopify',
        operation: 'createProductFromSapo',
        message: 'Shopify inventory failed',
      }),
    ]);
  });
});
