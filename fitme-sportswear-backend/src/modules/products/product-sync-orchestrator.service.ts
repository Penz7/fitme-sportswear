import { Injectable } from '@nestjs/common';
import { Prisma, ProductMappingStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramNotifierService } from '../notifications/telegram-notifier.service';
import { InventorySyncService } from './inventory-sync.service';
import {
  PlatformProductSnapshot,
  ProductMappingCandidate,
} from './types/platform-product-snapshot';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';
import { ProductSyncBlocklistService } from './product-sync-blocklist.service';
import { normalizeSku } from './sku-normalizer';

@Injectable()
export class ProductSyncOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: ProductSnapshotService,
    private readonly matchingService: ProductMatchingService,
    private readonly inventorySyncService: InventorySyncService,
    private readonly blocklistService: ProductSyncBlocklistService,
    private readonly notifier?: TelegramNotifierService,
  ) {}

  async run(syncRunId: string) {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });

    try {
      const snapshots = await this.refreshSnapshotsWithProgress(syncRunId);
      const rawMappings = await this.applyAmbiguousMappingConflicts(
        this.matchingService.buildMappings(snapshots),
      );
      const mappings = this.syncableMappings(rawMappings);
      await this.notifyShopifyProgress(syncRunId, snapshots, mappings);

      for (const mapping of mappings) {
        await this.upsertMapping(mapping);
      }

      await this.pruneIgnoredMappings(rawMappings, mappings);
      await this.recordConflicts(rawMappings);

      const syncResult = await this.inventorySyncService.syncMappings(mappings, {
        syncRunId,
        syncPancake: false,
      });
      const counts = this.countMappingStatuses(mappings);

      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          errorMessage: null,
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
            updatedShopifySkus: syncResult.updatedShopifySkus,
            createdShopifySkus: syncResult.createdShopifySkus,
            errors: syncResult.errors,
          } as unknown as Prisma.InputJsonObject,
        },
      });
      await this.notifyShopifySummary(syncRunId, counts, syncResult);
      await this.notifyPartialIssues(syncRunId, counts, syncResult.errors ?? []);
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      await this.notifier?.sendException(
        `Product sync failed: ${syncRunId}`,
        error,
      );
      throw error;
    }
  }

  async skipBecauseAnotherRunActive(syncRunId: string): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'succeeded',
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: {
          skipped: true,
          reason: 'another_product_sync_run_active',
        } as unknown as Prisma.InputJsonObject,
      },
    });
  }

  private async refreshSnapshotsWithProgress(
    syncRunId: string,
  ): Promise<PlatformProductSnapshot[]> {
    const refreshSapo = this.snapshotService.refreshSapoSnapshots?.bind(
      this.snapshotService,
    );
    const refreshPancake = this.snapshotService.refreshPancakeSnapshots?.bind(
      this.snapshotService,
    );
    const refreshShopify = this.snapshotService.refreshShopifySnapshots?.bind(
      this.snapshotService,
    );
    const cachedPancake = this.snapshotService.cachedPancakeSnapshots?.bind(
      this.snapshotService,
    );
    const livePancakeEnabled =
      process.env.SYNC_PANCAKE_PRODUCT_SYNC_ENABLED !== 'false' ||
      !cachedPancake;

    if (!refreshSapo || !refreshPancake || !refreshShopify) {
      await this.updateProgressMetadata(syncRunId, {
        stage: 'refreshing_snapshots',
      });
      return this.snapshotService.refreshAllSnapshots();
    }

    await this.updateProgressMetadata(syncRunId, {
      stage: 'refreshing_sapo_snapshots',
    });
    const sapo = await refreshSapo();

    await this.updateProgressMetadata(syncRunId, {
      stage: livePancakeEnabled
        ? 'refreshing_pancake_snapshots'
        : 'loading_cached_pancake_snapshots',
      sapoSnapshots: sapo.length,
    });
    const { snapshots: pancake, warning: pancakeWarning } = livePancakeEnabled
      ? await this.refreshPancakeSnapshotsWithFallback(syncRunId, refreshPancake)
      : {
          snapshots: await cachedPancake(),
          warning: 'Pancake live sync disabled; using cached Pancake snapshots.',
        };

    await this.updateProgressMetadata(syncRunId, {
      stage: 'refreshing_shopify_snapshots',
      sapoSnapshots: sapo.length,
      pancakeSnapshots: pancake.length,
      ...(pancakeWarning ? { warning: pancakeWarning } : {}),
    });
    const shopify = await refreshShopify();

    return [...sapo, ...pancake, ...shopify];
  }

  private async refreshPancakeSnapshotsWithFallback(
    syncRunId: string,
    refreshPancake: () => Promise<PlatformProductSnapshot[]>,
  ): Promise<{ snapshots: PlatformProductSnapshot[]; warning: string | null }> {
    try {
      return { snapshots: await refreshPancake(), warning: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Pancake snapshot error';
      const cached = await this.snapshotService.cachedPancakeSnapshots();

      await this.updateProgressMetadata(syncRunId, {
        stage: 'refreshing_pancake_snapshots_fallback_to_cache',
        warning: message,
        cachedPancakeSnapshots: cached.length,
      });

      return {
        snapshots: cached,
        warning: `Pancake live snapshot failed; using cache: ${message}`,
      };
    }
  }

  private async notifyShopifyProgress(
    syncRunId: string,
    snapshots: PlatformProductSnapshot[],
    mappings: ProductMappingCandidate[],
  ): Promise<void> {
    const shopifySnapshots = snapshots.filter(
      (snapshot) => snapshot.platform === 'shopify',
    ).length;
    const shopifyMappings = mappings.filter(
      (mapping) => Boolean(mapping.shopify?.variantId),
    ).length;

    await this.updateProgressMetadata(syncRunId, {
      stage: 'snapshots_refreshed',
      shopifySnapshots,
      shopifyMappings,
      totalMappings: mappings.length,
    });

    if (!this.notifier) {
      return;
    }

    try {
      await this.notifier.sendMessage(
        `Sapo -> Shopify inventory sync running: ${syncRunId}`,
        [
          `stage=snapshots_refreshed`,
          `shopifySnapshots=${shopifySnapshots}`,
          `shopifyMappings=${shopifyMappings}`,
          `totalMappings=${mappings.length}`,
        ].join('\n'),
      );
    } catch {
      return;
    }
  }

  private async updateProgressMetadata(
    syncRunId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          metadata,
        },
      });
    } catch {
      return;
    }
  }

  private async notifyShopifySummary(
    syncRunId: string,
    counts: { matched: number; partial: number; conflict: number },
    syncResult: {
      updatedShopify: number;
      createdShopify?: number;
      updatedShopifySkus?: string[];
      createdShopifySkus?: string[];
      errors?: Array<{
        sku?: string;
        platform?: string;
        operation?: string;
        message?: string;
      }>;
    },
  ): Promise<void> {
    if (!this.notifier) {
      return;
    }

    const shopifyErrors = (syncResult.errors ?? []).filter(
      (error) => error.platform === 'shopify',
    );
    const sampleErrors = shopifyErrors
      .slice(0, 3)
      .map((error) =>
        [error.sku, error.operation, error.message].filter(Boolean).join(' | '),
      )
      .join('\n');

    try {
      await this.notifier.sendMessage(
        `Sapo -> Shopify inventory sync completed: ${syncRunId}`,
        [
          `updatedShopify=${syncResult.updatedShopify}`,
          `createdShopify=${syncResult.createdShopify ?? 0}`,
          `shopifyErrors=${shopifyErrors.length}`,
          `updatedShopifySkusSample=${this.sample(syncResult.updatedShopifySkus ?? [])}`,
          `createdShopifySkusSample=${this.sample(syncResult.createdShopifySkus ?? [])}`,
          `matched=${counts.matched}`,
          `partial=${counts.partial}`,
          `conflict=${counts.conflict}`,
          sampleErrors ? `sample shopify errors:\n${sampleErrors}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch {
      return;
    }
  }

  private sample(items: string[]): string {
    return items.length > 0 ? items.join(', ') : 'none';
  }

  private async notifyPartialIssues(
    syncRunId: string,
    counts: { matched: number; partial: number; conflict: number },
    errors: Array<{ sku?: string; platform?: string; operation?: string; message?: string }>,
  ): Promise<void> {
    if (!this.notifier || errors.length === 0) {
      return;
    }

    const sampleErrors = errors
      .slice(0, 3)
      .map((error) =>
        [error.sku, error.platform, error.operation, error.message]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');

    try {
      await this.notifier.sendMessage(
        `Product sync completed with issues: ${syncRunId}`,
        [
          `conflict=${counts.conflict}`,
          `partial=${counts.partial}`,
          `errors=${errors.length}`,
          sampleErrors ? `sample errors:\n${sampleErrors}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch {
      return;
    }
  }

  private syncableMappings(
    mappings: ProductMappingCandidate[],
  ): ProductMappingCandidate[] {
    const blockedSkus = this.blocklistService.load();
    return mappings.filter((mapping) => {
      if (blockedSkus.has(mapping.normalizedSku)) {
        return false;
      }

      if (mapping.status === 'conflict') {
        return false;
      }

      return Boolean(mapping.sapo);
    });
  }

  private async pruneIgnoredMappings(
    rawMappings: ProductMappingCandidate[],
    syncableMappings: ProductMappingCandidate[],
  ): Promise<void> {
    const syncableSkus = new Set(syncableMappings.map((mapping) => mapping.sku));
    const ignoredSkus = rawMappings
      .map((mapping) => mapping.sku)
      .filter((sku) => !syncableSkus.has(sku));

    if (ignoredSkus.length === 0) {
      return;
    }

    const productMapping = this.prisma.productMapping as unknown as {
      deleteMany?: PrismaService['productMapping']['deleteMany'];
    };
    if (!productMapping.deleteMany) {
      return;
    }

    await productMapping.deleteMany({
      where: { sku: { in: ignoredSkus } },
    });
  }

  private async upsertMapping(mapping: ProductMappingCandidate) {
    if (mapping.conflictDetail?.type === 'ambiguous_mapping') {
      await this.prisma.productMapping.update({
        where: { sku: mapping.sku },
        data: {
          status: ProductMappingStatus.conflict,
          conflictReason: mapping.conflictReason,
        },
      });
      return;
    }

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

  private async applyAmbiguousMappingConflicts(
    mappings: ProductMappingCandidate[],
  ): Promise<ProductMappingCandidate[]> {
    const existingMappings = await this.prisma.productMapping.findMany();
    const byNormalizedSku = new Map<string, typeof existingMappings>();

    for (const existing of existingMappings) {
      const normalizedSku = normalizeSku(existing.sku);
      const entries = byNormalizedSku.get(normalizedSku) ?? [];
      entries.push(existing);
      byNormalizedSku.set(normalizedSku, entries);
    }

    return mappings.map((mapping) => {
      const existingEntries = byNormalizedSku.get(mapping.normalizedSku) ?? [];
      if (existingEntries.length === 0) {
        return mapping;
      }

      const existing = existingEntries.find((entry) => entry.sku === mapping.sku) ?? existingEntries[0];
      const mismatch = this.findAmbiguousMappingMismatch(mapping, existing);

      if (!mismatch && existingEntries.length === 1) {
        return mapping;
      }

      const message =
        mismatch ??
        `Multiple existing product mappings normalize to SKU ${mapping.normalizedSku}`;

      return {
        ...mapping,
        sku: existing.sku,
        status: 'conflict' as const,
        conflictReason: message,
        conflictDetail: {
          type: 'ambiguous_mapping' as const,
          platform: 'mapping' as const,
          message,
          sapoVariantCount: mapping.sapo ? 1 : 0,
          pancakeVariantCount: mapping.pancake ? 1 : 0,
          shopifyVariantCount: mapping.shopify ? 1 : 0,
          entries: [
            mapping.sapo,
            mapping.pancake,
            mapping.shopify,
          ]
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .map((entry) => ({
              platform: entry.platform,
              sku: entry.sku,
              productId: entry.productId,
              variantId: entry.variantId,
              warehouseId: entry.warehouseId,
              name: entry.name,
            })),
        },
      };
    });
  }

  private findAmbiguousMappingMismatch(
    mapping: ProductMappingCandidate,
    existing: {
      sapoProductId: string | null;
      sapoVariantId: string | null;
      pancakeProductId: string | null;
      pancakeVariantId: string | null;
      shopifyProductId: string | null;
      shopifyVariantId: string | null;
    },
  ): string | null {
    const checks: Array<[string, string | null | undefined, string | null]> = [
      ['sapoVariantId', mapping.sapo?.variantId, existing.sapoVariantId],
      ['sapoProductId', mapping.sapo?.productId, existing.sapoProductId],
      ['pancakeVariantId', mapping.pancake?.variantId, existing.pancakeVariantId],
      ['pancakeProductId', mapping.pancake?.productId, existing.pancakeProductId],
      ['shopifyVariantId', mapping.shopify?.variantId, existing.shopifyVariantId],
      ['shopifyProductId', mapping.shopify?.productId, existing.shopifyProductId],
    ];

    const mismatch = checks.find(
      ([, latest, previous]) => Boolean(latest) && Boolean(previous) && latest !== previous,
    );

    return mismatch
      ? `Existing product mapping ${mismatch[0]}=${mismatch[2]} differs from latest ${mismatch[0]}=${mismatch[1]}`
      : null;
  }

  private async recordConflicts(
    mappings: ProductMappingCandidate[],
  ): Promise<void> {
    const conflictMappings = mappings.filter(
      (mapping) => mapping.status === 'conflict' && mapping.conflictDetail,
    );

    for (const mapping of conflictMappings) {
      await this.recordConflict(mapping);
    }

    await this.resolveAbsentConflicts(conflictMappings);
  }

  private async resolveAbsentConflicts(
    conflictMappings: ProductMappingCandidate[],
  ): Promise<void> {
    const productSyncConflict = (this.prisma as any).productSyncConflict;
    const unresolved = await productSyncConflict.findMany({
      where: { resolvedAt: null },
      select: {
        id: true,
        normalizedSku: true,
        conflictType: true,
        platform: true,
      },
    });
    const currentKeys = new Set(
      conflictMappings
        .filter((mapping) => mapping.conflictDetail)
        .map(
          (mapping) =>
            `${mapping.normalizedSku}:${mapping.conflictDetail!.type}:${mapping.conflictDetail!.platform}`,
        ),
    );
    const resolvedIds = unresolved
      .filter(
        (conflict: {
          id: string;
          normalizedSku: string;
          conflictType: string;
          platform: string;
        }) =>
          !currentKeys.has(
            `${conflict.normalizedSku}:${conflict.conflictType}:${conflict.platform}`,
          ),
      )
      .map((conflict: { id: string }) => conflict.id);

    if (resolvedIds.length === 0) {
      return;
    }

    await productSyncConflict.updateMany({
      where: { id: { in: resolvedIds } },
      data: { resolvedAt: new Date() },
    });
  }

  private async recordConflict(mapping: ProductMappingCandidate): Promise<void> {
    const conflictDetail = mapping.conflictDetail;

    if (!conflictDetail) {
      return;
    }

    const now = new Date();
    const originalSkus = {
      sapo: conflictDetail.entries
        .filter((entry) => entry.platform === 'sapo')
        .map((entry) => entry.sku),
      pancake: conflictDetail.entries
        .filter((entry) => entry.platform === 'pancake')
        .map((entry) => entry.sku),
      shopify: conflictDetail.entries
        .filter((entry) => entry.platform === 'shopify')
        .map((entry) => entry.sku),
    };
    const involvedEntities = conflictDetail.entries.map((entry) => ({
      platform: entry.platform,
      sku: entry.sku,
      productId: entry.productId,
      variantId: entry.variantId,
      warehouseId: entry.warehouseId,
      name: entry.name,
    }));
    const data = {
      originalSkus,
      involvedEntities,
      message: conflictDetail.message,
      lastSeenAt: now,
      resolvedAt: null,
    };
    const productSyncConflict = (this.prisma as any).productSyncConflict;
    const conflict = await productSyncConflict.upsert({
      where: {
        normalizedSku_conflictType_platform: {
          normalizedSku: mapping.normalizedSku,
          conflictType: conflictDetail.type,
          platform: conflictDetail.platform,
        },
      },
      create: {
        normalizedSku: mapping.normalizedSku,
        conflictType: conflictDetail.type,
        platform: conflictDetail.platform,
        ...data,
      },
      update: data,
    });

    if (conflict.lastNotifiedAt || !this.notifier) {
      return;
    }

    try {
      await this.notifier.sendMessage(
        '[Fitme Sync] SKU conflict detected',
        [
          `SKU: ${mapping.normalizedSku}`,
          `Issue: ${conflictDetail.type}`,
          `Sapo variants: ${conflictDetail.sapoVariantCount}`,
          `Pancake variants: ${conflictDetail.pancakeVariantCount}`,
          'Action: skipped inventory sync.',
        ].join('\n'),
      );
    } catch {
      return;
    }

    await productSyncConflict.update({
      where: { id: conflict.id },
      data: { lastNotifiedAt: new Date() },
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
