import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramNotifierService } from '../notifications/telegram-notifier.service';
import { PancakeClient } from '../pancake/pancake.client';
import { SapoClient } from '../sapo/sapo.client';
import { ProductMatchingService } from './product-matching.service';
import {
  mapPancakeProductSnapshot,
  mapSapoProductSnapshot,
} from './product-snapshot.mapper';
import { ProductSyncBlocklistService } from './product-sync-blocklist.service';
import { ProductMappingCandidate } from './types/platform-product-snapshot';
import { normalizeSku } from './sku-normalizer';

export interface SapoToPancakeInventorySyncInput {
  syncRunId: string;
  dryRun?: boolean;
  approved?: boolean;
  productIds?: string[];
  skus?: string[];
}

export interface SapoToPancakeInventorySyncResult {
  mode: 'reconciliation' | 'targeted';
  dryRun: boolean;
  circuitBreakerTripped: boolean;
  candidates: number;
  hotCandidates: number;
  backlogCandidates: number;
  checkpoint: number;
  remaining: number;
  partial: boolean;
  skippedReason?: string;
  stage?: string;
  pancakeSnapshotSource: 'live' | 'cache';
  pancakeFetchError?: string;
  updated: number;
  updatedSkus: string[];
  failed: number;
  skippedEqual: number;
  skippedBlocked: number;
  skippedConflict: number;
  skippedMissingPancake: number;
  errors: Array<{ sku: string; message: string }>;
}

@Injectable()
export class SapoToPancakeInventorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly pancakeClient: PancakeClient,
    private readonly matchingService: ProductMatchingService,
    private readonly blocklistService: ProductSyncBlocklistService,
    private readonly configService: ConfigService,
    private readonly notifier: TelegramNotifierService,
  ) {}

  async run(
    input: SapoToPancakeInventorySyncInput,
  ): Promise<SapoToPancakeInventorySyncResult> {
    await this.prisma.syncRun.update({
      where: { id: input.syncRunId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const result = this.buildResult(input);
      const mappings = await this.loadMappings(input, result);
      const blocked = this.blocklistService.load();
      const candidates: ProductMappingCandidate[] = [];

      for (const mapping of mappings) {
        if (blocked.has(mapping.normalizedSku)) {
          result.skippedBlocked += 1;
        } else if (mapping.status === 'conflict' || !mapping.sapo) {
          result.skippedConflict += 1;
        } else if (!mapping.pancake?.variantId || !mapping.pancake.warehouseId) {
          result.skippedMissingPancake += 1;
        } else if (mapping.sapo.available === mapping.pancake.available) {
          result.skippedEqual += 1;
        } else if (mapping.sapo.available !== null) {
          candidates.push(mapping);
        }
      }

      result.candidates = candidates.length;
      const selectedCandidates = this.selectCandidates(candidates, result);
      const threshold = this.configNumber(
        'sync.sapoToPancakeInventory.circuitBreakerThreshold',
        500,
      );
      if (!input.approved && selectedCandidates.length > threshold) {
        result.circuitBreakerTripped = true;
        result.remaining = candidates.length;
        result.partial = candidates.length > 0;
        await this.complete(input.syncRunId, result);
        await this.notifier.sendMessage(
          'Sapo -> Pancake inventory sync blocked by circuit breaker',
          `selected=${selectedCandidates.length}, candidates=${candidates.length}, threshold=${threshold}, syncRunId=${input.syncRunId}`,
        );
        return result;
      }

      if (!input.dryRun) {
        await this.updateStage(input.syncRunId, result, 'updating_pancake');
        await this.updateInBatches(
          input.syncRunId,
          candidates.length,
          selectedCandidates,
          result,
        );
      } else {
        result.remaining = candidates.length;
        result.partial = candidates.length > 0;
      }

      await this.complete(input.syncRunId, result);
      await this.sendCompletionSummary(input.syncRunId, result);
      if (result.errors.length > 0) {
        await this.notifier.sendMessage(
          'Sapo -> Pancake inventory sync completed with errors',
          `updated=${result.updated}, errors=${result.errors.length}, syncRunId=${input.syncRunId}`,
        );
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.syncRun.update({
        where: { id: input.syncRunId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      await this.notifier.sendException(
        `Sapo -> Pancake inventory sync failed: ${input.syncRunId}`,
        error,
      );
      throw error;
    }
  }

  async skipBecauseAnotherRunActive(
    input: SapoToPancakeInventorySyncInput,
  ): Promise<SapoToPancakeInventorySyncResult> {
    const result = this.buildResult(input);
    result.skippedReason = 'another_inventory_sync_running';

    await this.prisma.syncRun.update({
      where: { id: input.syncRunId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        metadata: result as unknown as Prisma.InputJsonObject,
      },
    });

    return result;
  }

  private async loadMappings(
    input: SapoToPancakeInventorySyncInput,
    result: SapoToPancakeInventorySyncResult,
  ) {
    const productIds = [...new Set(input.productIds ?? [])].filter(Boolean);
    const requestedSkus = new Set(
      (input.skus ?? []).map(normalizeSku).filter(Boolean),
    );
    const targeted = productIds.length > 0 || requestedSkus.size > 0;
    await this.updateStage(input.syncRunId, result, 'fetching_sapo_products');
    const sapoProducts = await this.fetchSapoProductsForSync(targeted, productIds);
    await this.updateStage(input.syncRunId, result, 'mapping_sapo_products');
    const sapoSnapshots = sapoProducts.flatMap(mapSapoProductSnapshot).filter(
      (snapshot) =>
        !targeted ||
        requestedSkus.size === 0 ||
        requestedSkus.has(snapshot.normalizedSku),
    );
    const sapoSearchSkus = [
      ...new Set(sapoSnapshots.map((snapshot) => snapshot.sku).filter(Boolean)),
    ];
    await this.updateStage(input.syncRunId, result, 'fetching_pancake_products');
    const pancakeProducts = await this.fetchPancakeProductsForSync(
      targeted,
      sapoSearchSkus,
      result,
    );
    await this.updateStage(input.syncRunId, result, 'mapping_pancake_products');
    const pancakeSnapshots = pancakeProducts
      .map(mapPancakeProductSnapshot)
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));

    await this.updateStage(input.syncRunId, result, 'matching_products');
    return this.matchingService.buildMappings([
      ...sapoSnapshots,
      ...pancakeSnapshots,
    ]);
  }

  private async fetchSapoProductsForSync(
    targeted: boolean,
    productIds: string[],
  ): Promise<Awaited<ReturnType<SapoClient['fetchProducts']>>> {
    try {
      return targeted && productIds.length > 0
        ? await Promise.all(productIds.map((id) => this.sapoClient.fetchProduct(id)))
        : await this.sapoClient.fetchProducts();
    } catch (error) {
      throw this.withContext('Sapo product fetch failed during inventory sync', error);
    }
  }

  private async fetchPancakeProductsForSync(
    targeted: boolean,
    sapoSearchSkus: string[],
    result: SapoToPancakeInventorySyncResult,
  ): Promise<Awaited<ReturnType<PancakeClient['fetchProducts']>>> {
    try {
      const products = targeted
        ? (
            await Promise.all(
              sapoSearchSkus.map((sku) =>
                this.pancakeClient.fetchProductsBySku(sku),
              ),
            )
          ).flat()
        : await this.pancakeClient.fetchProducts();
      result.pancakeSnapshotSource = 'live';
      return products;
    } catch (error) {
      if (!targeted) {
        const cachedProducts = await this.cachedPancakeProducts();
        if (cachedProducts.length > 0) {
          result.pancakeSnapshotSource = 'cache';
          result.pancakeFetchError = error instanceof Error ? error.message : String(error);
          await this.notifier.sendMessage(
            'Sapo -> Pancake inventory sync using cached Pancake snapshot',
            `reason=${result.pancakeFetchError}\ncachedSkus=${cachedProducts.length}`,
          );
          return cachedProducts;
        }
      }

      throw this.withContext(
        'Pancake product fetch failed during inventory sync',
        error,
      );
    }
  }

  private async cachedPancakeProducts(): Promise<
    Awaited<ReturnType<PancakeClient['fetchProducts']>>
  > {
    const rows = await this.prisma.pancakeProduct.findMany({
      where: {
        variantId: { not: null },
        warehouseId: { not: null },
        available: { not: null },
      },
    });

    return rows.map((row) => ({
      id: row.variantId!,
      product_id: row.productId ?? undefined,
      barcode: row.sku,
      retail_price: row.retailPrice === null ? undefined : Number(row.retailPrice),
      product: { name: row.name ?? row.sku },
      variations_warehouses: [
        {
          warehouse_id: row.warehouseId ?? undefined,
          remain_quantity: row.available ?? undefined,
          actual_remain_quantity: row.remain ?? row.available ?? undefined,
        },
      ],
    }));
  }

  private async updateInBatches(
    syncRunId: string,
    totalCandidates: number,
    selectedCandidates: ProductMappingCandidate[],
    result: SapoToPancakeInventorySyncResult,
  ) {
    const batchSize = this.configNumber('sync.sapoToPancakeInventory.batchSize', 100);
    const delayMs = this.configNumber('sync.sapoToPancakeInventory.delayMs', 50);

    for (let index = 0; index < selectedCandidates.length; index += batchSize) {
      const batch = selectedCandidates.slice(index, index + batchSize);
      for (const mapping of batch) {
        await this.updateOne(mapping, result);
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      result.checkpoint = Math.min(index + batch.length, selectedCandidates.length);
      result.remaining = totalCandidates - result.checkpoint;
      result.partial = result.remaining > 0;
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          metadata: result as unknown as Prisma.InputJsonObject,
        },
      });
    }

    result.remaining = totalCandidates - result.checkpoint;
    result.partial = result.remaining > 0;
  }

  private async updateOne(
    mapping: ProductMappingCandidate,
    result: SapoToPancakeInventorySyncResult,
  ) {
    const attempts = this.configNumber('sync.sapoToPancakeInventory.retryAttempts', 3);
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.pancakeClient.updateInventory({
          variantId: mapping.pancake!.variantId!,
          warehouseId: mapping.pancake!.warehouseId,
          available: mapping.sapo!.available!,
        });
        await this.prisma.pancakeProduct.upsert({
          where: { sku: mapping.sku },
          create: {
            sku: mapping.sku,
            productId: mapping.pancake!.productId,
            variantId: mapping.pancake!.variantId,
            warehouseId: mapping.pancake!.warehouseId,
            available: mapping.sapo!.available,
            remain: mapping.pancake!.remain,
            retailPrice: mapping.pancake!.retailPrice,
            updatedBy: 'SAPO',
          },
          update: {
            available: mapping.sapo!.available,
            updatedBy: 'SAPO',
          },
        });
        result.updated += 1;
        if (result.updatedSkus.length < 20) {
          result.updatedSkus.push(mapping.sku);
        }
        return;
      } catch (error) {
        if (attempt === attempts) {
          result.failed += 1;
          result.errors.push({
            sku: mapping.sku,
            message: error instanceof Error ? error.message : String(error),
          });
        } else {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
    }
  }

  private prioritizeCandidates(candidates: ProductMappingCandidate[]): {
    hot: ProductMappingCandidate[];
    backlog: ProductMappingCandidate[];
  } {
    const hotWindowMinutes = this.configNumber(
      'sync.sapoToPancakeInventory.hotWindowMinutes',
      30,
    );
    const cutoff = Date.now() - hotWindowMinutes * 60 * 1000;
    const hot: ProductMappingCandidate[] = [];
    const backlog: ProductMappingCandidate[] = [];

    for (const candidate of candidates) {
      const updatedAt = candidate.sapo?.sourceUpdatedAt?.getTime();
      if (updatedAt !== undefined && updatedAt >= cutoff) {
        hot.push(candidate);
      } else {
        backlog.push(candidate);
      }
    }

    return {
      hot: this.sortCandidates(hot),
      backlog: this.sortCandidates(backlog),
    };
  }

  private selectCandidates(
    candidates: ProductMappingCandidate[],
    result: SapoToPancakeInventorySyncResult,
  ): ProductMappingCandidate[] {
    const maxUpdatesPerRun = this.configNumber(
      'sync.sapoToPancakeInventory.maxUpdatesPerRun',
      200,
    );
    const prioritizedCandidates = this.prioritizeCandidates(candidates);
    result.hotCandidates = prioritizedCandidates.hot.length;
    result.backlogCandidates = prioritizedCandidates.backlog.length;
    const backlogLimit =
      maxUpdatesPerRun > 0
        ? Math.min(maxUpdatesPerRun, prioritizedCandidates.backlog.length)
        : prioritizedCandidates.backlog.length;

    return [
      ...prioritizedCandidates.hot,
      ...prioritizedCandidates.backlog.slice(0, backlogLimit),
    ];
  }

  private sortCandidates(
    candidates: ProductMappingCandidate[],
  ): ProductMappingCandidate[] {
    return [...candidates].sort((a, b) => {
      const updatedA = a.sapo?.sourceUpdatedAt?.getTime() ?? 0;
      const updatedB = b.sapo?.sourceUpdatedAt?.getTime() ?? 0;
      if (updatedA !== updatedB) {
        return updatedB - updatedA;
      }
      return a.normalizedSku.localeCompare(b.normalizedSku);
    });
  }

  private buildResult(
    input: SapoToPancakeInventorySyncInput,
  ): SapoToPancakeInventorySyncResult {
    return {
      mode:
        (input.productIds?.length ?? 0) > 0 || (input.skus?.length ?? 0) > 0
          ? 'targeted'
          : 'reconciliation',
      dryRun: input.dryRun ?? false,
      circuitBreakerTripped: false,
      candidates: 0,
      hotCandidates: 0,
      backlogCandidates: 0,
      checkpoint: 0,
      remaining: 0,
      partial: false,
      stage: 'queued',
      pancakeSnapshotSource: 'live',
      updated: 0,
      updatedSkus: [],
      failed: 0,
      skippedEqual: 0,
      skippedBlocked: 0,
      skippedConflict: 0,
      skippedMissingPancake: 0,
      errors: [],
    };
  }

  private async complete(syncRunId: string, result: SapoToPancakeInventorySyncResult) {
    result.stage = 'completed';
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        metadata: result as unknown as Prisma.InputJsonObject,
      },
    });
  }

  private async sendCompletionSummary(
    syncRunId: string,
    result: SapoToPancakeInventorySyncResult,
  ) {
    if (result.dryRun) {
      return;
    }

    const updatedSkus =
      result.updatedSkus.length > 0 ? result.updatedSkus.join(', ') : 'none';
    await this.notifier.sendMessage(
      'Sapo -> Pancake inventory sync completed',
      [
        `status=succeeded`,
        `mode=${result.mode}`,
        `updated=${result.updated}`,
        `failed=${result.failed}`,
        `remaining=${result.remaining}`,
        `candidates=${result.candidates}`,
        `hotCandidates=${result.hotCandidates}`,
        `backlogCandidates=${result.backlogCandidates}`,
        `pancakeSnapshotSource=${result.pancakeSnapshotSource}`,
        result.pancakeFetchError ? `pancakeFetchError=${result.pancakeFetchError}` : null,
        `partial=${result.partial}`,
        `syncRunId=${syncRunId}`,
        `updatedSkus=${updatedSkus}`,
      ].filter(Boolean).join('\n'),
    );
  }

  private async updateStage(
    syncRunId: string,
    result: SapoToPancakeInventorySyncResult,
    stage: string,
  ): Promise<void> {
    result.stage = stage;
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        metadata: result as unknown as Prisma.InputJsonObject,
      },
    });
  }

  private configNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get<number | string | undefined>(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private withContext(context: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`${context}: ${message}`);
  }
}
