import { Injectable } from '@nestjs/common';
import { Prisma, ProductMappingStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMappingCandidate } from './types/platform-product-snapshot';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';

@Injectable()
export class ProductSyncOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: ProductSnapshotService,
    private readonly matchingService: ProductMatchingService,
    private readonly inventorySyncService: InventorySyncService,
  ) {}

  async run(syncRunId: string) {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      const snapshots = await this.snapshotService.refreshAllSnapshots();
      const mappings = this.matchingService.buildMappings(snapshots);

      for (const mapping of mappings) {
        await this.upsertMapping(mapping);
      }

      const syncResult = await this.inventorySyncService.syncMappings(mappings);
      const counts = this.countMappingStatuses(mappings);

      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          metadata: {
            snapshots: snapshots.length,
            mappings: mappings.length,
            matched: counts.matched,
            partial: counts.partial,
            conflict: counts.conflict,
            updatedPancake: syncResult.updatedPancake,
            updatedShopify: syncResult.updatedShopify,
            createdPancake: syncResult.createdPancake,
            createdShopify: syncResult.createdShopify,
            errors: syncResult.errors,
          } as unknown as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async upsertMapping(mapping: ProductMappingCandidate) {
    const data = this.toMappingData(mapping);

    await this.prisma.productMapping.upsert({
      where: { sku: mapping.sku },
      create: {
        sku: mapping.sku,
        ...data,
      },
      update: data,
    });
  }

  private toMappingData(
    mapping: ProductMappingCandidate,
  ): Omit<Prisma.ProductMappingUncheckedCreateInput, 'sku'> {
    return {
      sapoProductId: mapping.sapo?.productId ?? null,
      sapoVariantId: mapping.sapo?.variantId ?? null,
      pancakeProductId: mapping.pancake?.productId ?? null,
      pancakeVariantId: mapping.pancake?.variantId ?? null,
      pancakeWarehouseId: mapping.pancake?.warehouseId ?? null,
      shopifyProductId: mapping.shopify?.productId ?? null,
      shopifyVariantId: mapping.shopify?.variantId ?? null,
      status: mapping.status as ProductMappingStatus,
      conflictReason: mapping.conflictReason,
    };
  }

  private countMappingStatuses(mappings: ProductMappingCandidate[]) {
    return mappings.reduce(
      (counts, mapping) => ({
        ...counts,
        [mapping.status]: counts[mapping.status] + 1,
      }),
      { matched: 0, partial: 0, conflict: 0 },
    );
  }
}
