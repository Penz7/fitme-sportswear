import { SapoToPancakeInventorySyncService } from './sapo-to-pancake-inventory-sync.service';

describe('SapoToPancakeInventorySyncService', () => {
  function createService(options: {
    sapoAvailable?: number;
    pancakeAvailable?: number;
    blocked?: boolean;
    threshold?: number;
    maxUpdatesPerRun?: number;
    hotWindowMinutes?: number;
    mappings?: Array<{
      sku: string;
      sapoAvailable: number;
      pancakeAvailable: number;
      updatedAt?: string;
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
        mappingInputs.map((item, index) => ({
          id: `pancake-variant-${index + 1}`,
          product_id: `pancake-product-${index + 1}`,
          barcode: item.sku,
          retail_price: 100,
          product: { name: 'Product' },
          variations_warehouses: [
            {
              warehouse_id: 'warehouse-1',
              remain_quantity: item.pancakeAvailable,
              actual_remain_quantity: item.pancakeAvailable,
            },
          ],
        })),
      ),
      updateInventory: jest.fn().mockResolvedValue(undefined),
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
      expect.stringContaining('updated=1'),
    );
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Sapo -> Pancake inventory sync completed',
      expect.stringContaining('updatedSkus=SKU-1'),
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
});
