import { Injectable } from '@nestjs/common';
import {
  PlatformProductSnapshot,
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
      const entries = bySku.get(snapshot.sku) ?? [];
      entries.push(snapshot);
      bySku.set(snapshot.sku, entries);
    }

    return [...bySku.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sku, entries]) => this.buildMapping(sku, entries));
  }

  private buildMapping(
    sku: string,
    entries: PlatformProductSnapshot[],
  ): ProductMappingCandidate {
    const sapo = this.singlePlatform(entries, 'sapo');
    const pancake = this.singlePlatform(entries, 'pancake');
    const shopify = this.singlePlatform(entries, 'shopify');
    const duplicatePlatform = this.findDuplicatePlatform(entries);

    if (duplicatePlatform) {
      return {
        sku,
        sapo,
        pancake,
        shopify,
        status: 'conflict',
        conflictReason: `Duplicate SKU in ${duplicatePlatform}`,
      };
    }

    if (pancake && pancake.warehouseCount !== null && pancake.warehouseCount > 1) {
      return {
        sku,
        sapo,
        pancake,
        shopify,
        status: 'conflict',
        conflictReason: 'Pancake SKU has multiple warehouses',
      };
    }

    if (!sapo) {
      return {
        sku,
        sapo,
        pancake,
        shopify,
        status: 'partial',
        conflictReason: 'Missing Sapo source record',
      };
    }

    if (!pancake && !shopify) {
      return {
        sku,
        sapo,
        pancake,
        shopify,
        status: 'partial',
        conflictReason: 'Missing Pancake and Shopify records',
      };
    }

    return {
      sku,
      sapo,
      pancake,
      shopify,
      status: 'matched',
      conflictReason: null,
    };
  }

  private singlePlatform(
    entries: PlatformProductSnapshot[],
    platform: ProductPlatform,
  ): PlatformProductSnapshot | null {
    return entries.find((entry) => entry.platform === platform) ?? null;
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
}
