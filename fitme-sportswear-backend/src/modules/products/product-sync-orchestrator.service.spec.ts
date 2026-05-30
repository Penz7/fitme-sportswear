import { ProductMappingStatus } from '@prisma/client';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';
import { ProductSyncOrchestratorService } from './product-sync-orchestrator.service';
import { PlatformProductSnapshot, ProductMappingCandidate } from './types/platform-product-snapshot';

describe('ProductSyncOrchestratorService', () => {
  it('refreshes snapshots, upserts mappings, syncs inventory, and marks run succeeded', async () => {
    const syncRunId = 'sync-run-1';
    const sapoSnapshot: PlatformProductSnapshot = {
      platform: 'sapo',
      sku: 'SKU-1',
      productId: 'sapo-product-1',
      variantId: 'sapo-variant-1',
      name: 'Product 1',
      available: 5,
      remain: 5,
      retailPrice: 100000,
      warehouseId: null,
      warehouseCount: null,
    };
    const snapshots = [sapoSnapshot];
    const mapping: ProductMappingCandidate = {
      sku: 'SKU-1',
      sapo: sapoSnapshot,
      pancake: null,
      shopify: null,
      status: 'partial',
      conflictReason: 'Missing Pancake and Shopify records',
    };
    const syncResult = {
      updatedPancake: 0,
      updatedShopify: 0,
      errors: [],
    };
    const prisma = {
      productMapping: { upsert: jest.fn().mockResolvedValue({}) },
      syncRun: { update: jest.fn().mockResolvedValue({}) },
    };
    const snapshotService = {
      refreshAllSnapshots: jest.fn().mockResolvedValue(snapshots),
    } as unknown as ProductSnapshotService;
    const matchingService = {
      buildMappings: jest.fn().mockReturnValue([mapping]),
    } as unknown as ProductMatchingService;
    const inventorySyncService = {
      syncMappings: jest.fn().mockResolvedValue(syncResult),
    } as unknown as InventorySyncService;

    const service = new ProductSyncOrchestratorService(
      prisma as any,
      snapshotService,
      matchingService,
      inventorySyncService,
    );

    await service.run(syncRunId);

    expect(snapshotService.refreshAllSnapshots).toHaveBeenCalledTimes(1);
    expect(matchingService.buildMappings).toHaveBeenCalledWith(snapshots);
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-1' },
      create: {
        sku: 'SKU-1',
        sapoProductId: 'sapo-product-1',
        sapoVariantId: 'sapo-variant-1',
        pancakeProductId: null,
        pancakeVariantId: null,
        pancakeWarehouseId: null,
        shopifyProductId: null,
        shopifyVariantId: null,
        status: ProductMappingStatus.partial,
        conflictReason: 'Missing Pancake and Shopify records',
      },
      update: {
        sapoProductId: 'sapo-product-1',
        sapoVariantId: 'sapo-variant-1',
        pancakeProductId: null,
        pancakeVariantId: null,
        pancakeWarehouseId: null,
        shopifyProductId: null,
        shopifyVariantId: null,
        status: ProductMappingStatus.partial,
        conflictReason: 'Missing Pancake and Shopify records',
      },
    });
    expect(inventorySyncService.syncMappings).toHaveBeenCalledWith([mapping]);
    expect(prisma.syncRun.update).toHaveBeenCalledWith({
      where: { id: syncRunId },
      data: expect.objectContaining({
        status: 'succeeded',
        finishedAt: expect.any(Date),
      }),
    });
  });
});
