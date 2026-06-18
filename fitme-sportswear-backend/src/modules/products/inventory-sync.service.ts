import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TelegramNotifierService } from '../notifications/telegram-notifier.service';
import { PancakeClient } from '../pancake/pancake.client';
import { ShopifyClient } from '../shopify/shopify.client';
import { isComboSku } from './combo-sku';
import { ProductMappingCandidate } from './types/platform-product-snapshot';
import { normalizeSku } from './sku-normalizer';

export interface ProductSyncError {
  sku: string;
  platform: 'pancake' | 'shopify';
  operation: string;
  message: string;
}

export interface InventorySyncResult {
  updatedPancake: number;
  updatedShopify: number;
  createdPancake: number;
  createdShopify: number;
  updatedShopifySkus: string[];
  createdShopifySkus: string[];
  errors: ProductSyncError[];
}

export interface InventorySyncOptions {
  syncRunId?: string;
  syncPancake?: boolean;
}

interface ShopifyCandidateGroups {
  ordered: ProductMappingCandidate[];
  hotCount: number;
  backlogCount: number;
}

@Injectable()
export class InventorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pancakeClient: PancakeClient,
    private readonly shopifyClient: ShopifyClient,
    private readonly configService: ConfigService,
    private readonly notifier?: TelegramNotifierService,
  ) {}

  async syncMappings(
    mappings: ProductMappingCandidate[],
    options: InventorySyncOptions = {},
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      updatedPancake: 0,
      updatedShopify: 0,
      createdPancake: 0,
      createdShopify: 0,
      updatedShopifySkus: [],
      createdShopifySkus: [],
      errors: [],
    };
    const blockedSkus = this.productSyncSkuBlocklist();
    const shopifyCreateAllowlist = this.createMissingShopifySkuAllowlist();
    const shopifyCandidateGroups = this.shopifyCandidateGroups(
      mappings,
      blockedSkus,
      shopifyCreateAllowlist,
    );
    const shopifyCandidates = shopifyCandidateGroups.ordered.length;
    const shopifyProgressInterval = this.configNumber(
      'sync.shopifyProgressInterval',
      100,
    );
    let processedShopify = 0;
    let createdMissingShopifyAttempts = 0;
    let updatedShopifySkusSinceLastProgress: string[] = [];
    let createdShopifySkusSinceLastProgress: string[] = [];
    const syncPancake = options.syncPancake !== false;

    for (const mapping of syncPancake ? mappings : []) {
      if (this.blockedSku(mapping.sku, blockedSkus)) {
        continue;
      }

      if (
        mapping.status === 'conflict' ||
        !mapping.sapo ||
        mapping.sapo.available === null
      ) {
        continue;
      }

      if (mapping.pancake?.variantId && !this.unchangedPancakeInventory(mapping)) {
        try {
          await this.pancakeClient.updateInventory({
            variantId: mapping.pancake.variantId,
            warehouseId: this.resolvePancakeWarehouseId(mapping.pancake.warehouseId),
            available: mapping.sapo.available,
          });
          await this.prisma.pancakeProduct.update({
            where: { sku: mapping.sku },
            data: {
              available: mapping.sapo.available,
              retailPrice: mapping.sapo.retailPrice,
              updatedBy: 'SAPO',
            },
          });
          result.updatedPancake += 1;
        } catch (error) {
          result.errors.push(
            this.toError(mapping.sku, 'pancake', 'updateInventory', error),
          );
        }
      }

      if (
        !mapping.pancake?.variantId &&
        this.createMissingPancakeProducts()
      ) {
        try {
          const existingMapping = await this.findExistingProductMapping(mapping);
          const existingPancake = await this.findExistingPancakeProduct(mapping);

          if (existingMapping?.pancakeVariantId || existingPancake?.variantId) {
            const variantId =
              existingMapping?.pancakeVariantId ?? existingPancake?.variantId;
            const productId =
              existingMapping?.pancakeProductId ?? existingPancake?.productId;
            if (!variantId) {
              continue;
            }
            const warehouseId = this.resolvePancakeWarehouseId(
              existingMapping?.pancakeWarehouseId ??
                existingPancake?.warehouseId ??
                null,
            );
            await this.pancakeClient.updateInventory({
              variantId,
              warehouseId,
              available: mapping.sapo.available,
            });
            await this.prisma.pancakeProduct.upsert({
              where: { sku: mapping.sku },
              create: {
                sku: mapping.sku,
                productId,
                variantId,
                name: mapping.sapo.name,
                available: mapping.sapo.available,
                remain: mapping.sapo.remain,
                retailPrice: mapping.sapo.retailPrice,
                warehouseId,
                updatedBy: 'SAPO',
              },
              update: {
                productId,
                variantId,
                name: mapping.sapo.name,
                available: mapping.sapo.available,
                remain: mapping.sapo.remain,
                retailPrice: mapping.sapo.retailPrice,
                warehouseId,
                updatedBy: 'SAPO',
              },
            });
            await this.upsertProductMapping(mapping, {
              pancakeProductId: productId,
              pancakeVariantId: variantId,
              pancakeWarehouseId: warehouseId,
            });
            result.updatedPancake += 1;
          } else if (!isComboSku(mapping.sku)) {
            const created = await this.pancakeClient.createProductFromSapo({
              sku: mapping.sku,
              name: mapping.sapo.name,
              available: mapping.sapo.available,
              retailPrice: mapping.sapo.retailPrice,
            });
            const warehouseId = this.resolvePancakeWarehouseId(created.warehouseId);
            await this.prisma.pancakeProduct.upsert({
              where: { sku: mapping.sku },
              create: {
                sku: mapping.sku,
                productId: created.productId,
                variantId: created.variantId,
                name: mapping.sapo.name,
                available: mapping.sapo.available,
                remain: mapping.sapo.remain,
                retailPrice: mapping.sapo.retailPrice,
                warehouseId,
                updatedBy: 'SAPO',
              },
              update: {
                productId: created.productId,
                variantId: created.variantId,
                name: mapping.sapo.name,
                available: mapping.sapo.available,
                remain: mapping.sapo.remain,
                retailPrice: mapping.sapo.retailPrice,
                warehouseId,
                updatedBy: 'SAPO',
              },
            });
            await this.upsertProductMapping(mapping, {
              pancakeProductId: created.productId,
              pancakeVariantId: created.variantId,
              pancakeWarehouseId: warehouseId,
            });
            await this.pancakeClient.updateInventory({
              variantId: created.variantId,
              warehouseId,
              available: mapping.sapo.available,
            });
            result.createdPancake += 1;
          }
        } catch (error) {
          result.errors.push(
            this.toError(mapping.sku, 'pancake', 'createProductFromSapo', error),
          );
        }
      }
    }

    for (const mapping of shopifyCandidateGroups.ordered) {
      if (!mapping.sapo || mapping.sapo.available === null) {
        continue;
      }

      if (mapping.shopify?.variantId && !this.unchangedShopifyInventory(mapping)) {
        try {
          await this.shopifyClient.updateInventoryAndPrice({
            variantId: mapping.shopify.variantId,
            available: mapping.sapo.available,
            retailPrice: mapping.sapo.retailPrice,
          });
          await this.prisma.shopifyProduct.update({
            where: { sku: mapping.sku },
            data: {
              available: BigInt(mapping.sapo.available),
              retailPrice: mapping.sapo.retailPrice,
              updatedBy: 'SAPO',
            },
          });
          result.updatedShopify += 1;
          if (result.updatedShopifySkus.length < 20) {
            result.updatedShopifySkus.push(mapping.sku);
          }
          if (updatedShopifySkusSinceLastProgress.length < 20) {
            updatedShopifySkusSinceLastProgress.push(mapping.sku);
          }
        } catch (error) {
          result.errors.push(
            this.toError(
              mapping.sku,
              'shopify',
              'updateInventoryAndPrice',
              error,
            ),
          );
        } finally {
          processedShopify += 1;
          const notified = await this.notifyShopifyProgress(options.syncRunId, {
            shopifyCandidates,
            hotShopifyCandidates: shopifyCandidateGroups.hotCount,
            backlogShopifyCandidates: shopifyCandidateGroups.backlogCount,
            processedShopify,
            interval: shopifyProgressInterval,
            result,
            updatedShopifySkusSample: updatedShopifySkusSinceLastProgress,
            createdShopifySkusSample: createdShopifySkusSinceLastProgress,
          });
          if (notified) {
            updatedShopifySkusSinceLastProgress = [];
            createdShopifySkusSinceLastProgress = [];
          }
        }
      }

      if (
        !mapping.shopify?.variantId &&
        this.canCreateMissingShopifyProduct(
          mapping,
          shopifyCreateAllowlist,
          createdMissingShopifyAttempts,
        )
      ) {
        createdMissingShopifyAttempts += 1;
        try {
          const created = await this.shopifyClient.createProductFromSapo({
            sku: mapping.sku,
            name: mapping.sapo.name,
            available: mapping.sapo.available,
            retailPrice: mapping.sapo.retailPrice,
          });
          await this.prisma.shopifyProduct.upsert({
            where: { sku: mapping.sku },
            create: {
              sku: mapping.sku,
              productId: created.productId,
              variantId: created.variantId,
              name: mapping.sapo.name,
              available: BigInt(mapping.sapo.available),
              remain:
                mapping.sapo.remain === null ? null : BigInt(mapping.sapo.remain),
              retailPrice: mapping.sapo.retailPrice,
              updatedBy: 'SAPO',
            },
            update: {
              productId: created.productId,
              variantId: created.variantId,
              name: mapping.sapo.name,
              available: BigInt(mapping.sapo.available),
              remain:
                mapping.sapo.remain === null ? null : BigInt(mapping.sapo.remain),
              retailPrice: mapping.sapo.retailPrice,
              updatedBy: 'SAPO',
            },
          });
          await this.upsertProductMapping(mapping, {
            shopifyProductId: created.productId,
            shopifyVariantId: created.variantId,
          });
          await this.shopifyClient.updateInventoryAndPrice({
            variantId: created.variantId,
            available: mapping.sapo.available,
            retailPrice: mapping.sapo.retailPrice,
          });
          result.createdShopify += 1;
          if (result.createdShopifySkus.length < 20) {
            result.createdShopifySkus.push(mapping.sku);
          }
          if (createdShopifySkusSinceLastProgress.length < 20) {
            createdShopifySkusSinceLastProgress.push(mapping.sku);
          }
        } catch (error) {
          result.errors.push(
            this.toError(mapping.sku, 'shopify', 'createProductFromSapo', error),
          );
        } finally {
          processedShopify += 1;
          const notified = await this.notifyShopifyProgress(options.syncRunId, {
            shopifyCandidates,
            hotShopifyCandidates: shopifyCandidateGroups.hotCount,
            backlogShopifyCandidates: shopifyCandidateGroups.backlogCount,
            processedShopify,
            interval: shopifyProgressInterval,
            result,
            updatedShopifySkusSample: updatedShopifySkusSinceLastProgress,
            createdShopifySkusSample: createdShopifySkusSinceLastProgress,
          });
          if (notified) {
            updatedShopifySkusSinceLastProgress = [];
            createdShopifySkusSinceLastProgress = [];
          }
        }
      }
    }

    return result;
  }

  private shopifyCandidateGroups(
    mappings: ProductMappingCandidate[],
    blockedSkus: string[],
    shopifyCreateAllowlist: string[],
  ): ShopifyCandidateGroups {
    const hot: ProductMappingCandidate[] = [];
    const backlog: ProductMappingCandidate[] = [];
    const createLimit = this.createMissingShopifyMaxPerRun();
    let createCandidates = 0;

    for (const mapping of this.sortShopifyCandidates(mappings)) {
      if (!this.isShopifyCandidate(mapping, blockedSkus, shopifyCreateAllowlist)) {
        continue;
      }

      if (!mapping.shopify?.variantId) {
        if (createLimit > 0 && createCandidates >= createLimit) {
          continue;
        }
        createCandidates += 1;
      }

      if (this.isHotShopifyCandidate(mapping)) {
        hot.push(mapping);
      } else {
        backlog.push(mapping);
      }
    }

    return {
      ordered: [...hot, ...backlog],
      hotCount: hot.length,
      backlogCount: backlog.length,
    };
  }

  private sortShopifyCandidates(
    mappings: ProductMappingCandidate[],
  ): ProductMappingCandidate[] {
    return [...mappings].sort((left, right) => {
      const leftTime = left.sapo?.sourceUpdatedAt?.getTime() ?? 0;
      const rightTime = right.sapo?.sourceUpdatedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });
  }

  private isShopifyCandidate(
    mapping: ProductMappingCandidate,
    blockedSkus: string[],
    shopifyCreateAllowlist: string[],
  ): boolean {
    if (
      this.blockedSku(mapping.sku, blockedSkus) ||
      mapping.status === 'conflict' ||
      !mapping.sapo ||
      mapping.sapo.available === null
    ) {
      return false;
    }

    if (mapping.shopify?.variantId) {
      return !this.unchangedShopifyInventory(mapping);
    }

    return (
      !isComboSku(mapping.sku) &&
      this.createMissingShopifyProducts() &&
      this.matchesShopifyCreateAllowlist(mapping, shopifyCreateAllowlist)
    );
  }

  private isHotShopifyCandidate(mapping: ProductMappingCandidate): boolean {
    const updatedAt = mapping.sapo?.sourceUpdatedAt?.getTime();
    if (updatedAt === undefined) {
      return false;
    }

    const hotWindowMinutes = this.configNumber(
      'sync.shopifyInventoryHotWindowMinutes',
      30,
    );
    return updatedAt >= Date.now() - hotWindowMinutes * 60 * 1000;
  }

  private async notifyShopifyProgress(
    syncRunId: string | undefined,
    input: {
      shopifyCandidates: number;
      hotShopifyCandidates: number;
      backlogShopifyCandidates: number;
      processedShopify: number;
      interval: number;
      result: InventorySyncResult;
      updatedShopifySkusSample: string[];
      createdShopifySkusSample: string[];
    },
  ): Promise<boolean> {
    if (!syncRunId || input.shopifyCandidates === 0) {
      return false;
    }

    const shouldNotify =
      input.processedShopify === input.shopifyCandidates ||
      input.processedShopify % Math.max(input.interval, 1) === 0;
    if (!shouldNotify) {
      return false;
    }

    const shopifyErrors = input.result.errors.filter(
      (error) => error.platform === 'shopify',
    ).length;

    await this.updateShopifyProgressMetadata(syncRunId, {
      stage: 'updating_shopify',
      processedShopify: input.processedShopify,
      remainingShopify: Math.max(
        input.shopifyCandidates - input.processedShopify,
        0,
      ),
      shopifyCandidates: input.shopifyCandidates,
      hotShopifyCandidates: input.hotShopifyCandidates,
      backlogShopifyCandidates: input.backlogShopifyCandidates,
      updatedShopify: input.result.updatedShopify,
      createdShopify: input.result.createdShopify,
      shopifyErrors,
      updatedShopifySkusSample: input.updatedShopifySkusSample,
      createdShopifySkusSample: input.createdShopifySkusSample,
    });

    if (!this.notifier) {
      return true;
    }

    try {
      await this.notifier.sendMessage(
        `Sapo -> Shopify inventory sync progress: ${syncRunId}`,
        [
          `stage=updating_shopify`,
          `processedShopify=${input.processedShopify}`,
          `remainingShopify=${Math.max(input.shopifyCandidates - input.processedShopify, 0)}`,
          `shopifyCandidates=${input.shopifyCandidates}`,
          `hotShopifyCandidates=${input.hotShopifyCandidates}`,
          `backlogShopifyCandidates=${input.backlogShopifyCandidates}`,
          `updatedShopify=${input.result.updatedShopify}`,
          `createdShopify=${input.result.createdShopify}`,
          `shopifyErrors=${shopifyErrors}`,
          `updatedShopifySkusSample=${this.sample(input.updatedShopifySkusSample)}`,
          `createdShopifySkusSample=${this.sample(input.createdShopifySkusSample)}`,
        ].join('\n'),
      );
      return true;
    } catch {
      return false;
    }
  }

  private async updateShopifyProgressMetadata(
    syncRunId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: { metadata },
      });
    } catch {
      return;
    }
  }

  private sample(items: string[]): string {
    return items.length > 0 ? items.join(', ') : 'none';
  }

  private toError(
    sku: string,
    platform: ProductSyncError['platform'],
    operation: string,
    error: unknown,
  ): ProductSyncError {
    return {
      sku,
      platform,
      operation,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  private async upsertProductMapping(
    mapping: ProductMappingCandidate,
    created: {
      pancakeProductId?: string | null;
      pancakeVariantId?: string | null;
      pancakeWarehouseId?: string | null;
      shopifyProductId?: string | null;
      shopifyVariantId?: string | null;
    },
  ): Promise<void> {
    await this.prisma.productMapping.upsert({
      where: { sku: mapping.sku },
      create: {
        sku: mapping.sku,
        sapoProductId: mapping.sapo?.productId ?? null,
        sapoVariantId: mapping.sapo?.variantId ?? null,
        pancakeProductId: created.pancakeProductId ?? mapping.pancake?.productId ?? null,
        pancakeVariantId: created.pancakeVariantId ?? mapping.pancake?.variantId ?? null,
        pancakeWarehouseId:
          created.pancakeWarehouseId ?? mapping.pancake?.warehouseId ?? null,
        shopifyProductId: created.shopifyProductId ?? mapping.shopify?.productId ?? null,
        shopifyVariantId: created.shopifyVariantId ?? mapping.shopify?.variantId ?? null,
        status: 'matched',
        conflictReason: null,
      },
      update: {
        sapoProductId: mapping.sapo?.productId ?? null,
        sapoVariantId: mapping.sapo?.variantId ?? null,
        pancakeProductId: created.pancakeProductId ?? mapping.pancake?.productId ?? null,
        pancakeVariantId: created.pancakeVariantId ?? mapping.pancake?.variantId ?? null,
        pancakeWarehouseId:
          created.pancakeWarehouseId ?? mapping.pancake?.warehouseId ?? null,
        shopifyProductId: created.shopifyProductId ?? mapping.shopify?.productId ?? null,
        shopifyVariantId: created.shopifyVariantId ?? mapping.shopify?.variantId ?? null,
        status: 'matched',
        conflictReason: null,
      },
    });
  }

  private async findExistingProductMapping(
    mapping: ProductMappingCandidate,
  ): Promise<{
    pancakeProductId: string | null;
    pancakeVariantId: string | null;
    pancakeWarehouseId: string | null;
  } | null> {
    const exact = await this.prisma.productMapping.findUnique({
      where: { sku: mapping.sku },
    });

    if (exact?.pancakeVariantId) {
      return exact;
    }

    const mappings = await this.prisma.productMapping.findMany();
    return (
      mappings.find(
        (productMapping) =>
          normalizeSku(productMapping.sku) === mapping.normalizedSku &&
          Boolean(productMapping.pancakeVariantId),
      ) ?? null
    );
  }

  private async findExistingPancakeProduct(
    mapping: ProductMappingCandidate,
  ): Promise<{
    sku: string;
    productId: string | null;
    variantId: string | null;
    warehouseId: string | null;
  } | null> {
    const exact = await this.prisma.pancakeProduct.findUnique({
      where: { sku: mapping.sku },
    });

    if (exact?.variantId) {
      return exact;
    }

    const products = await this.prisma.pancakeProduct.findMany();
    return (
      products.find(
        (product) =>
          normalizeSku(product.sku) === mapping.normalizedSku &&
          Boolean(product.variantId),
      ) ?? null
    );
  }

  private unchangedPancakeInventory(mapping: ProductMappingCandidate): boolean {
    return this.unchangedTargetInventory(mapping, mapping.pancake);
  }

  private unchangedShopifyInventory(mapping: ProductMappingCandidate): boolean {
    return this.unchangedTargetInventory(mapping, mapping.shopify);
  }

  private unchangedTargetInventory(
    mapping: ProductMappingCandidate,
    target: ProductMappingCandidate['pancake'] | ProductMappingCandidate['shopify'],
  ): boolean {
    if (!mapping.sapo || !target || !mapping.sapo.sourceUpdatedAt) {
      return false;
    }

    const minutesDiff = Math.abs(
      Date.now() - mapping.sapo.sourceUpdatedAt.getTime(),
    ) / 60000;

    return (
      minutesDiff < 10 &&
      mapping.sapo.available === target.available &&
      mapping.sapo.retailPrice === target.retailPrice
    );
  }

  private resolvePancakeWarehouseId(warehouseId: string | null): string | null {
    if (warehouseId) {
      return warehouseId;
    }

    const fallback = this.configService.get<string | undefined>(
      'pancake.defaultWarehouseId',
    );
    return fallback && fallback.trim() !== '' ? fallback : null;
  }

  private blockedSku(sku: string, blocklist: string[]): boolean {
    if (blocklist.length === 0) {
      return false;
    }

    const normalizedSku = normalizeSku(sku);
    return blocklist.some(
      (blockedSku) => normalizeSku(blockedSku) === normalizedSku,
    );
  }

  private productSyncSkuBlocklist(): string[] {
    return [
      ...this.configStringList('sync.products.skuBlocklist'),
      ...this.configJsonStringList('sync.products.skuBlocklistFile'),
    ];
  }

  private createMissingPancakeProducts(): boolean {
    return this.configBoolean('sync.products.createMissingPancake', true);
  }

  private createMissingShopifyProducts(): boolean {
    return this.configBoolean('sync.products.createMissingShopify', false);
  }

  private createMissingShopifyMaxPerRun(): number {
    return this.configNumber('sync.products.createMissingShopifyMaxPerRun', 20);
  }

  private createMissingShopifySkuAllowlist(): string[] {
    return this.configStringList(
      'sync.products.createMissingShopifySkuAllowlist',
    ).map((sku) => normalizeSku(sku));
  }

  private canCreateMissingShopifyProduct(
    mapping: ProductMappingCandidate,
    allowlist: string[],
    attempted: number,
  ): boolean {
    if (!this.createMissingShopifyProducts()) {
      return false;
    }

    const maxPerRun = this.createMissingShopifyMaxPerRun();
    if (maxPerRun > 0 && attempted >= maxPerRun) {
      return false;
    }

    return this.matchesShopifyCreateAllowlist(mapping, allowlist);
  }

  private matchesShopifyCreateAllowlist(
    mapping: ProductMappingCandidate,
    allowlist: string[],
  ): boolean {
    return allowlist.length === 0 || allowlist.includes(mapping.normalizedSku);
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }

  private configNumber(key: string, fallback: number): number {
    const value = this.configService.get<number | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private configStringList(key: string): string[] {
    const value = this.configService.get<string[] | string | undefined>(key);
    if (Array.isArray(value)) {
      return value;
    }

    if (!value) {
      return [];
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private configJsonStringList(key: string): string[] {
    const filePath = this.configService.get<string | undefined>(key);
    if (!filePath) {
      return [];
    }

    const resolvedPath = this.resolveConfiguredFilePath(filePath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Product sync SKU blocklist file not found: ${resolvedPath}`);
    }

    const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8')) as unknown;
    const values = this.asStringArray(parsed)
      ? parsed
      : this.firstJsonStringArray(parsed, ['blockedSkus', 'skus', 'blocklist']);

    if (!values) {
      throw new Error(
        `Product sync SKU blocklist file must be a string array or contain blockedSkus: ${resolvedPath}`,
      );
    }

    return values
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private firstJsonStringArray(
    value: unknown,
    keys: string[],
  ): string[] | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const objectValue = value as Record<string, unknown>;
    for (const key of keys) {
      const candidate = objectValue[key];
      if (
        Array.isArray(candidate) &&
        candidate.every((item) => typeof item === 'string')
      ) {
        return candidate;
      }
    }

    return null;
  }

  private resolveConfiguredFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }

    const candidates = [
      resolve(process.cwd(), filePath),
      resolve(__dirname, '../../..', filePath),
    ];

    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  private asStringArray(value: unknown): value is string[] {
    return (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string')
    );
  }
}
