import { Injectable } from '@nestjs/common';
import {
  PlatformProductSnapshot,
  ProductConflictDetail,
  ProductMappingCandidate,
  ProductPlatform,
} from './types/platform-product-snapshot';

@Injectable()
export class ProductMatchingService {
  buildMappings(
    snapshots: PlatformProductSnapshot[],
  ): ProductMappingCandidate[] {
    const bySku = new Map<string, PlatformProductSnapshot[]>();

    for (const snapshot of snapshots) {
      const entries = bySku.get(snapshot.normalizedSku) ?? [];
      entries.push(snapshot);
      bySku.set(snapshot.normalizedSku, entries);
    }

    return [...bySku.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([normalizedSku, entries]) =>
        this.buildMapping(normalizedSku, entries),
      );
  }

  private buildMapping(
    normalizedSku: string,
    entries: PlatformProductSnapshot[],
  ): ProductMappingCandidate {
    const sapo = this.singlePlatform(entries, 'sapo');
    const pancake = this.singlePlatform(entries, 'pancake');
    const shopify = this.singlePlatform(entries, 'shopify');
    const duplicatePlatform = this.findDuplicatePlatform(entries);
    const sku = this.representativeSku(normalizedSku, entries);

    if (duplicatePlatform) {
      return {
        sku,
        normalizedSku,
        sapo,
        pancake,
        shopify,
        status: 'conflict',
        conflictReason: `Duplicate SKU in ${duplicatePlatform}: ${this.describeEntries(entries, duplicatePlatform)}`,
        conflictDetail: this.buildConflictDetail(
          this.duplicateConflictType(duplicatePlatform),
          duplicatePlatform,
          `Duplicate normalized SKU in ${duplicatePlatform}`,
          entries,
        ),
      };
    }

    if (pancake && pancake.warehouseCount !== null && pancake.warehouseCount > 1) {
      return {
        sku,
        normalizedSku,
        sapo,
        pancake,
        shopify,
        status: 'conflict',
        conflictReason: 'Pancake SKU has multiple warehouses',
        conflictDetail: this.buildConflictDetail(
          'multiple_pancake_warehouses',
          'pancake',
          'Pancake SKU has multiple warehouses',
          entries,
        ),
      };
    }

    if (!sapo) {
      return {
        sku,
        normalizedSku,
        sapo,
        pancake,
        shopify,
        status: 'partial',
        conflictReason: 'Missing Sapo source record',
        conflictDetail: null,
      };
    }

    if (!pancake && !shopify) {
      return {
        sku,
        normalizedSku,
        sapo,
        pancake,
        shopify,
        status: 'partial',
        conflictReason: 'Missing Pancake and Shopify records',
        conflictDetail: null,
      };
    }

    return {
      sku,
      normalizedSku,
      sapo,
      pancake,
      shopify,
      status: 'matched',
      conflictReason: null,
      conflictDetail: null,
    };
  }

  private singlePlatform(
    entries: PlatformProductSnapshot[],
    platform: ProductPlatform,
  ): PlatformProductSnapshot | null {
    return entries.find((entry) => entry.platform === platform) ?? null;
  }

  private representativeSku(
    normalizedSku: string,
    entries: PlatformProductSnapshot[],
  ): string {
    for (const platform of ['sapo', 'pancake', 'shopify'] as const) {
      const sku = this.stablePlatformSku(entries, platform);
      if (sku) {
        return sku;
      }
    }

    return normalizedSku;
  }

  private stablePlatformSku(
    entries: PlatformProductSnapshot[],
    platform: ProductPlatform,
  ): string | null {
    const skus = entries
      .filter((entry) => entry.platform === platform)
      .map((entry) => entry.sku)
      .sort((a, b) => {
        const trimmedOrder = a.trim().localeCompare(b.trim());
        return trimmedOrder === 0 ? a.localeCompare(b) : trimmedOrder;
      });

    return skus[0] ?? null;
  }

  private describeEntries(
    entries: PlatformProductSnapshot[],
    platform: ProductPlatform,
  ): string {
    return entries
      .filter((entry) => entry.platform === platform)
      .map((entry) =>
        [
          `product=${entry.productId ?? 'unknown'}`,
          `variant=${entry.variantId ?? 'unknown'}`,
          entry.warehouseId ? `warehouse=${entry.warehouseId}` : null,
          entry.name ? `name=${entry.name}` : null,
        ]
          .filter(Boolean)
          .join(','),
      )
      .join('; ');
  }

  private findDuplicatePlatform(
    entries: PlatformProductSnapshot[],
  ): ProductPlatform | null {
    for (const platform of ['sapo', 'pancake', 'shopify'] as const) {
      if (entries.filter((entry) => entry.platform === platform).length > 1) {
        return platform;
      }
    }

    return null;
  }

  private duplicateConflictType(
    platform: ProductPlatform,
  ): ProductConflictDetail['type'] {
    if (platform === 'sapo') {
      return 'duplicate_sapo_sku';
    }

    if (platform === 'pancake') {
      return 'duplicate_pancake_sku';
    }

    return 'duplicate_shopify_sku';
  }

  private buildConflictDetail(
    type: ProductConflictDetail['type'],
    platform: ProductConflictDetail['platform'],
    message: string,
    entries: PlatformProductSnapshot[],
  ): ProductConflictDetail {
    return {
      type,
      platform,
      message,
      sapoVariantCount: entries.filter((entry) => entry.platform === 'sapo')
        .length,
      pancakeVariantCount: entries.filter(
        (entry) => entry.platform === 'pancake',
      ).length,
      shopifyVariantCount: entries.filter(
        (entry) => entry.platform === 'shopify',
      ).length,
      entries: entries.map((entry) => ({
        platform: entry.platform,
        sku: entry.sku,
        productId: entry.productId,
        variantId: entry.variantId,
        warehouseId: entry.warehouseId,
        name: entry.name,
      })),
    };
  }
}
