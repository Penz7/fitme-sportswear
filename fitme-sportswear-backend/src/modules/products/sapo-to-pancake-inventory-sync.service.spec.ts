import { SapoToPancakeInventorySyncService } from './sapo-to-pancake-inventory-sync.service';

describe('SapoToPancakeInventorySyncService', () => {
  function createService(options: {
    sapoAvailable?: number;
    pancakeAvailable?: number;
    blocked?: boolean;
    threshold?: number;
    maxUpdatesPerRun?: number;
    hotWindowMinutes?: number;
    createRecentMissingPancake?: boolean;
    createRecentMissingPancakeWindowMinutes?: number;
    createRecentMissingPancakeMaxPerRun?: number;
    defaultPancakeWarehouseId?: string;
    mappings?: Array<{
      sku: string;
      sapoAvailable: number;
      pancakeAvailable: number;
      createdAt?: string;
      updatedAt?: string;
      missingPancake?: boolean;
      missingPancakeWarehouse?: boolean;
    }>;
  } = {}) {
    const sapoAvailable = options.sapoAvailable ?? 10;
    const pancakeAvailable = options.pancakeAvailable ?? 5;
    const mappingInputs = options.mappings ?? [
      { sku: 'SKU-1', sapoAvailable, pancakeAvailable },
    ];
    const prisma = {
      syncRun: { update: jest.fn().mockResolvedValue({}) },
      pancakeProduct: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue(
          mappingInputs.map((item, index) => ({
            sku: item.sku,
            productId: `cached-pancake-product-${index + 1}`,
            variantId: `cached-pancake-variant-${index + 1}`,
            warehouseId: 'warehouse-1',
            name: 'Cached Product',
            available: item.pancakeAvailable,
            remain: item.pancakeAvailable,
            retailPrice: 100,
          })),
        ),
      },
      productMapping: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const sapoClient = {
      fetchProducts: jest.fn().mockResolvedValue(
        mappingInputs.map((item, index) => ({
          id: `sapo-product-${index + 1}`,
          name: 'Product',
          variants: [
            {
              id: `sapo-variant-${index + 1}`,
              sku: item.sku,
              variantRetailPrice: 100,
              created_on: item.createdAt ?? item.updatedAt,
              updated_at: item.updatedAt,
              inventories: [
                { available: item.sapoAvailable, onHand: item.sapoAvailable },
              ],
            },
          ],
        })),
      ),
    };
    const pancakeClient = {
      fetchProducts: jest.fn().mockResolvedValue(
        mappingInputs
          .filter((item) => !item.missingPancake)
          .map((item, index) => ({
            id: `pancake-variant-${index + 1}`,
            product_id: `pancake-product-${index + 1}`,
            barcode: item.sku,
            retail_price: 100,
            product: { name: 'Product' },
            variations_warehouses: [
              {
                warehouse_id: item.missingPancakeWarehouse ? null : 'warehouse-1',
                remain_quantity: item.pancakeAvailable,
                actual_remain_quantity: item.pancakeAvailable,
              },
            ],
          })),
      ),
      updateInventory: jest.fn().mockResolvedValue(undefined),
      createProductFromSapo: jest.fn().mockResolvedValue({
        productId: 'created-pancake-product',
        variantId: 'created-pancake-variant',
        warehouseId: 'created-warehouse',
      }),
      updateCompositeProduct: jest.fn().mockResolvedValue(undefined),
    };
    const matchingService = {
      buildMappings: jest.fn((snapshots: any[]) => {
        return mappingInputs.map((item) => {
          const sapo = snapshots.find(
            (snapshot) => snapshot.platform === 'sapo' && snapshot.sku === item.sku,
          );
          const pancake = snapshots.find(
            (snapshot) =>
              snapshot.platform === 'pancake' && snapshot.sku === item.sku,
          );
          return {
            sku: item.sku,
            normalizedSku: item.sku,
            sapo,
            pancake,
            shopify: null,
            status: 'matched',
            conflictReason: null,
            conflictDetail: null,
          };
        });
      }),
    };
    const blocklistService = {
      load: jest.fn().mockReturnValue(
        options.blocked ? new Set(['SKU-1']) : new Set(),
      ),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'sync.sapoToPancakeInventory.circuitBreakerThreshold') {
          return options.threshold ?? 500;
        }
        if (key === 'sync.sapoToPancakeInventory.batchSize') return 100;
        if (key === 'sync.sapoToPancakeInventory.delayMs') return 0;
        if (key === 'sync.sapoToPancakeInventory.retryAttempts') return 3;
        if (key === 'sync.sapoToPancakeInventory.maxUpdatesPerRun') {
          return options.maxUpdatesPerRun ?? 200;
        }
        if (key === 'sync.sapoToPancakeInventory.hotWindowMinutes') {
          return options.hotWindowMinutes ?? 30;
        }
        if (key === 'sync.sapoToPancakeInventory.createRecentMissingPancake') {
          return options.createRecentMissingPancake ?? false;
        }
        if (key === 'sync.sapoToPancakeInventory.createRecentMissingPancakeWindowMinutes') {
          return options.createRecentMissingPancakeWindowMinutes ?? 60;
        }
        if (key === 'sync.sapoToPancakeInventory.createRecentMissingPancakeMaxPerRun') {
          return options.createRecentMissingPancakeMaxPerRun ?? 20;
        }
        if (key === 'pancake.defaultWarehouseId') {
          return options.defaultPancakeWarehouseId;
        }
        return undefined;
      }),
    };
    const notifier = { sendMessage: jest.fn().mockResolvedValue(undefined) };

    return {
      prisma,
      notifier,
      pancakeClient,
      service: new SapoToPancakeInventorySyncService(
        prisma as any,
        sapoClient as any,
        pancakeClient as any,
        matchingService as any,
        blocklistService as any,
        configService as any,
        notifier as any,
      ),
    };
  }

  it('always skips an SKU when Sapo and Pancake inventory are equal', async () => {
    const { service, pancakeClient } = createService({
      sapoAvailable: 10,
      pancakeAvailable: 10,
    });

    const result = await service.run({ syncRunId: 'run-1' });

    expect(result.skippedEqual).toBe(1);
    expect(result.candidates).toBe(0);
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
  });

  it('skips blocklisted SKU', async () => {
    const { service, pancakeClient } = createService({ blocked: true });

    const result = await service.run({ syncRunId: 'run-1' });

    expect(result.skippedBlocked).toBe(1);
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
  });

  it('trips circuit breaker before updating too many SKUs', async () => {
    const { service, pancakeClient } = createService({ threshold: 0 });

    const result = await service.run({ syncRunId: 'run-1' });

    expect(result.circuitBreakerTripped).toBe(true);
    expect(result.candidates).toBe(1);
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
  });

  it('updates Pancake inventory when approved', async () => {
    const { service, pancakeClient, prisma } = createService({ threshold: 0 });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.updated).toBe(1);
    expect(result.updatedSkus).toEqual(['SKU-1']);
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'pancake-variant-1',
      warehouseId: 'warehouse-1',
      available: 10,
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalled();
  });

  it('sends a Telegram summary after a real inventory sync', async () => {
    const { service, notifier } = createService();

    await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed',
      expect.stringContaining('updatedTotalThisRun=1'),
    );
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed',
      expect.stringContaining('updatedSkusSample=SKU-1'),
    );
  });

  it('does not send the operational Telegram summary for dry-run inventory checks', async () => {
    const { service, notifier } = createService();

    await service.run({
      syncRunId: 'run-1',
      dryRun: true,
    });

    expect(notifier.sendMessage).not.toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed',
      expect.any(String),
    );
  });

  it('limits updates per run and records remaining work', async () => {
    const { service, pancakeClient } = createService({
      maxUpdatesPerRun: 1,
      mappings: [
        { sku: 'SKU-1', sapoAvailable: 10, pancakeAvailable: 1 },
        { sku: 'SKU-2', sapoAvailable: 20, pancakeAvailable: 2 },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.updated).toBe(1);
    expect(result.checkpoint).toBe(1);
    expect(result.remaining).toBe(1);
    expect(result.partial).toBe(true);
    expect(pancakeClient.updateInventory).toHaveBeenCalledTimes(1);
  });

  it('does not cap hot SKUs with the backlog update limit', async () => {
    const now = new Date().toISOString();
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { service, pancakeClient } = createService({
      maxUpdatesPerRun: 1,
      hotWindowMinutes: 30,
      mappings: [
        { sku: 'BACKLOG-1', sapoAvailable: 10, pancakeAvailable: 1, updatedAt: old },
        { sku: 'HOT-1', sapoAvailable: 20, pancakeAvailable: 2, updatedAt: now },
        { sku: 'HOT-2', sapoAvailable: 30, pancakeAvailable: 3, updatedAt: now },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.hotCandidates).toBe(2);
    expect(result.backlogCandidates).toBe(1);
    expect(result.updated).toBe(3);
    expect(result.remaining).toBe(0);
    expect(result.partial).toBe(false);
    expect(pancakeClient.updateInventory).toHaveBeenCalledTimes(3);
    expect(pancakeClient.updateInventory).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ variantId: 'pancake-variant-2' }),
    );
    expect(pancakeClient.updateInventory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ variantId: 'pancake-variant-3' }),
    );
  });

  it('continues when one SKU update fails after retries', async () => {
    const { service, pancakeClient } = createService({
      mappings: [
        { sku: 'SKU-1', sapoAvailable: 10, pancakeAvailable: 1 },
        { sku: 'SKU-2', sapoAvailable: 20, pancakeAvailable: 2 },
      ],
    });
    pancakeClient.updateInventory
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.failed).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.updatedSkus).toEqual(['SKU-2']);
    expect(result.errors).toEqual([{ sku: 'SKU-1', message: 'timeout' }]);
    expect(pancakeClient.updateInventory).toHaveBeenCalledTimes(4);
  });

  it('falls back to cached Pancake product snapshots when full Pancake fetch times out', async () => {
    const { service, pancakeClient, prisma } = createService();
    pancakeClient.fetchProducts.mockRejectedValueOnce(new Error('timeout'));

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.pancakeSnapshotSource).toBe('cache');
    expect(result.pancakeFetchError).toBe('timeout');
    expect(result.updated).toBe(1);
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'cached-pancake-variant-1',
      warehouseId: 'warehouse-1',
      available: 10,
    });
    expect(prisma.pancakeProduct.findMany).toHaveBeenCalled();
  });

  it('creates recent Sapo SKUs missing in Pancake during inventory sync when enabled', async () => {
    const now = new Date().toISOString();
    const { service, pancakeClient, prisma } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: 'SKU-NEW',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(1);
    expect(result.createdMissingPancakeSkus).toEqual(['SKU-NEW']);
    expect(result.skippedMissingPancake).toBe(0);
    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith({
      sku: 'SKU-NEW',
      name: 'Product',
      available: 12,
      retailPrice: 100,
    });
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'created-pancake-variant',
      warehouseId: 'created-warehouse',
      available: 12,
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({
        productId: 'created-pancake-product',
        variantId: 'created-pancake-variant',
        available: 12,
      }),
      update: expect.objectContaining({
        productId: 'created-pancake-product',
        variantId: 'created-pancake-variant',
        available: 12,
      }),
    });
  });

  it('creates a recent missing combo SKU as a Pancake composite product when components exist', async () => {
    const comboSku = 'FM-AVBNU-XR-S-FM-QNTG01-DE-S';
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: comboSku,
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: new Date().toISOString(),
          missingPancake: true,
        },
        {
          sku: 'FM-AVBNU-XR-S',
          sapoAvailable: 20,
          pancakeAvailable: 20,
        },
        {
          sku: 'FM-QNTG01-DE-S',
          sapoAvailable: 15,
          pancakeAvailable: 15,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(0);
    expect(result.createdCompositePancake).toBe(1);
    expect(result.createdCompositePancakeSkus).toEqual([comboSku]);
    expect(result.skippedCompositeMissingComponents).toBe(0);
    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith({
      sku: comboSku,
      name: 'Product',
      available: 0,
      retailPrice: 100,
    });
    expect(pancakeClient.updateCompositeProduct).toHaveBeenCalledWith({
      comboVariantId: 'created-pancake-variant',
      components: [
        { variationId: 'pancake-variant-1', quantity: 1 },
        { variationId: 'pancake-variant-2', quantity: 1 },
      ],
    });
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
  });

  it('creates missing components before their combo in the same inventory sync run', async () => {
    const now = new Date().toISOString();
    const comboSku = 'FM-ATT01-HP-XL-FM-QNTT01-HP-XL';
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      createRecentMissingPancakeMaxPerRun: 3,
      mappings: [
        {
          sku: comboSku,
          sapoAvailable: 5,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
        {
          sku: 'FM-ATT01-HP-XL',
          sapoAvailable: 10,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
        {
          sku: 'FM-QNTT01-HP-XL',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
      ],
    });
    pancakeClient.createProductFromSapo
      .mockResolvedValueOnce({
        productId: 'component-product-1',
        variantId: 'component-variant-1',
        warehouseId: 'warehouse-1',
      })
      .mockResolvedValueOnce({
        productId: 'component-product-2',
        variantId: 'component-variant-2',
        warehouseId: 'warehouse-1',
      })
      .mockResolvedValueOnce({
        productId: 'combo-product',
        variantId: 'combo-variant',
        warehouseId: 'warehouse-1',
      });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(2);
    expect(result.createdCompositePancake).toBe(1);
    expect(result.skippedCompositeMissingComponents).toBe(0);
    expect(pancakeClient.createProductFromSapo.mock.calls.map(([input]) => input.sku)).toEqual([
      'FM-ATT01-HP-XL',
      'FM-QNTT01-HP-XL',
      comboSku,
    ]);
    expect(pancakeClient.updateCompositeProduct).toHaveBeenCalledWith({
      comboVariantId: 'combo-variant',
      components: [
        { variationId: 'component-variant-1', quantity: 1 },
        { variationId: 'component-variant-2', quantity: 1 },
      ],
    });
  });

  it('skips creating a missing combo SKU when a component is not present on Pancake', async () => {
    const comboSku = 'FM-ATSO01-DO-L-FM-VSFM01-TR-L';
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: comboSku,
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: new Date().toISOString(),
          missingPancake: true,
        },
        {
          sku: 'FM-ATSO01-DO-L',
          sapoAvailable: 20,
          pancakeAvailable: 20,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(0);
    expect(result.createdCompositePancake).toBe(0);
    expect(result.skippedCompositeMissingComponents).toBe(1);
    expect(result.skippedCompositeMissingComponentSkus).toEqual([
      {
        sku: comboSku,
        missingComponents: ['FM-VSFM01-TR-L'],
      },
    ]);
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateCompositeProduct).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
  });

  it('reports composite combo creation in the Telegram completion summary', async () => {
    const comboSku = 'FM-AVBNU-XR-S-FM-QNTG01-DE-S';
    const { service, notifier } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: comboSku,
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: new Date().toISOString(),
          missingPancake: true,
        },
        {
          sku: 'FM-AVBNU-XR-S',
          sapoAvailable: 20,
          pancakeAvailable: 20,
        },
        {
          sku: 'FM-QNTG01-DE-S',
          sapoAvailable: 15,
          pancakeAvailable: 15,
        },
      ],
    });

    await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed',
      expect.stringContaining('createdCompositePancake=1'),
    );
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed',
      expect.stringContaining(`createdCompositePancakeSkus=${comboSku}`),
    );
    expect(notifier.sendMessage).not.toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed with errors',
      expect.any(String),
    );
  });

  it('updates inventory normally for an existing combo SKU', async () => {
    const comboSku = 'FM-ATSO01-DO-L-FM-VSFM01-TR-L';
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      mappings: [
        {
          sku: comboSku,
          sapoAvailable: 12,
          pancakeAvailable: 3,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.updated).toBe(1);
    expect(result.createdCompositePancake).toBe(0);
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'pancake-variant-1',
      warehouseId: 'warehouse-1',
      available: 12,
    });
  });

  it('uses configured default Pancake warehouse when recent missing product create response has no warehouse', async () => {
    const now = new Date().toISOString();
    const { service, pancakeClient, prisma } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: 'SKU-NEW',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
      ],
    });
    pancakeClient.createProductFromSapo.mockResolvedValueOnce({
      productId: 'created-pancake-product',
      variantId: 'created-pancake-variant',
      warehouseId: null,
    });
    (service as any).configService.get.mockImplementation((key: string) => {
      if (key === 'pancake.defaultWarehouseId') return 'fallback-warehouse';
      if (key === 'sync.sapoToPancakeInventory.createRecentMissingPancake') return true;
      if (key === 'sync.sapoToPancakeInventory.createRecentMissingPancakeWindowMinutes') return 60;
      if (key === 'sync.sapoToPancakeInventory.createRecentMissingPancakeMaxPerRun') return 20;
      if (key === 'sync.sapoToPancakeInventory.circuitBreakerThreshold') return 500;
      if (key === 'sync.sapoToPancakeInventory.batchSize') return 100;
      if (key === 'sync.sapoToPancakeInventory.delayMs') return 0;
      if (key === 'sync.sapoToPancakeInventory.retryAttempts') return 3;
      if (key === 'sync.sapoToPancakeInventory.maxUpdatesPerRun') return 200;
      if (key === 'sync.sapoToPancakeInventory.hotWindowMinutes') return 30;
      return undefined;
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(1);
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'created-pancake-variant',
      warehouseId: 'fallback-warehouse',
      available: 12,
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-NEW' },
      create: expect.objectContaining({ warehouseId: 'fallback-warehouse' }),
      update: expect.objectContaining({ warehouseId: 'fallback-warehouse' }),
    });
  });

  it('updates existing Pancake SKU with configured default warehouse instead of recreating it', async () => {
    const { service, pancakeClient, prisma } = createService({
      defaultPancakeWarehouseId: 'fallback-warehouse',
      createRecentMissingPancake: true,
      mappings: [
        {
          sku: 'SKU-EXISTING',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: new Date().toISOString(),
          missingPancakeWarehouse: true,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.updated).toBe(1);
    expect(result.createdMissingPancake).toBe(0);
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
      variantId: 'pancake-variant-1',
      warehouseId: 'fallback-warehouse',
      available: 12,
    });
    expect(prisma.pancakeProduct.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-EXISTING' },
      create: expect.objectContaining({ warehouseId: 'fallback-warehouse' }),
      update: expect.objectContaining({ warehouseId: 'fallback-warehouse' }),
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-EXISTING' },
      create: expect.objectContaining({ pancakeWarehouseId: 'fallback-warehouse' }),
      update: expect.objectContaining({ pancakeWarehouseId: 'fallback-warehouse' }),
    });
  });

  it('does not create old missing Pancake SKUs in recent-only mode', async () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 30,
      mappings: [
        {
          sku: 'SKU-OLD',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: old,
          missingPancake: true,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(0);
    expect(result.skippedMissingPancake).toBe(1);
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
  });

  it('does not create or overwrite Pancake products when a recent Sapo SKU already exists in Pancake', async () => {
    const now = new Date().toISOString();
    const { service, pancakeClient, prisma } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: 'SKU-EXISTS',
          sapoAvailable: 12,
          pancakeAvailable: 12,
          updatedAt: now,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(0);
    expect(result.skippedEqual).toBe(1);
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(prisma.pancakeProduct.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { sku: 'SKU-EXISTS' } }),
    );
  });

  it('limits recent missing Pancake product creation per run', async () => {
    const now = new Date().toISOString();
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      createRecentMissingPancakeMaxPerRun: 1,
      mappings: [
        {
          sku: 'SKU-NEW-1',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
        {
          sku: 'SKU-NEW-2',
          sapoAvailable: 13,
          pancakeAvailable: 0,
          updatedAt: now,
          missingPancake: true,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(1);
    expect(result.skippedMissingPancake).toBe(1);
    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledTimes(1);
  });

  it('prioritizes the most recently created missing SKU when creation is limited', async () => {
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      createRecentMissingPancakeMaxPerRun: 1,
      mappings: [
        {
          sku: 'SKU-OLDER-A',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          missingPancake: true,
        },
        {
          sku: 'SKU-NEWEST-Z',
          sapoAvailable: 13,
          pancakeAvailable: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          missingPancake: true,
        },
      ],
    });

    await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledTimes(1);
    expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'SKU-NEWEST-Z' }),
    );
  });

  it('does not create an old missing SKU only because its inventory was recently updated', async () => {
    const { service, pancakeClient } = createService({
      createRecentMissingPancake: true,
      createRecentMissingPancakeWindowMinutes: 60,
      mappings: [
        {
          sku: 'SKU-OLD-UPDATED',
          sapoAvailable: 12,
          pancakeAvailable: 0,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
          missingPancake: true,
        },
      ],
    });

    const result = await service.run({
      syncRunId: 'run-1',
      approved: true,
    });

    expect(result.createdMissingPancake).toBe(0);
    expect(result.skippedMissingPancake).toBe(1);
    expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
  });
});
