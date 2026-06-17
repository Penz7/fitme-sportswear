import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PancakeClient } from '../pancake/pancake.client';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';
import {
  mapPancakeProductSnapshot,
  mapSapoProductSnapshot,
  mapShopifyProductSnapshots,
} from './product-snapshot.mapper';
import { PlatformProductSnapshot } from './types/platform-product-snapshot';

@Injectable()
export class ProductSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly pancakeClient: PancakeClient,
    private readonly shopifyClient: ShopifyClient,
    private readonly configService: ConfigService,
  ) {}

  async refreshAllSnapshots() {
    const sapo = await this.refreshSapoSnapshots();
    const pancake = await this.refreshPancakeSnapshots();
    const shopify = await this.refreshShopifySnapshots();

    return [...sapo, ...pancake, ...shopify];
  }

  async refreshSapoSnapshots() {
    const products = await this.sapoClient.fetchProducts();
    const snapshots = products.flatMap((product) =>
      mapSapoProductSnapshot(product),
    );

    const duplicateSkus = this.findDuplicateSkus(snapshots);

    for (const snapshot of snapshots) {
      if (duplicateSkus.has(snapshot.sku)) {
        continue;
      }

      const data = this.toSapoData(snapshot);
      await this.prisma.sapoProduct.upsert({
        where: { sku: snapshot.sku },
        create: data,
        update: data,
      });
    }

    return snapshots;
  }

  async refreshPancakeSnapshots() {
    const products = await this.pancakeClient.fetchProducts();
    const snapshots = products
      .map((product) => mapPancakeProductSnapshot(product))
      .filter(
        (snapshot): snapshot is PlatformProductSnapshot => Boolean(snapshot),
      );

    const duplicateSkus = this.findDuplicateSkus(snapshots);

    for (const snapshot of snapshots) {
      if (duplicateSkus.has(snapshot.sku)) {
        continue;
      }

      const data = this.toPancakeData(snapshot);
      await this.prisma.pancakeProduct.upsert({
        where: { sku: snapshot.sku },
        create: data,
        update: data,
      });
    }

    return snapshots;
  }

  async refreshShopifySnapshots() {
    if (!this.configBoolean('sync.products.shopifyEnabled', false)) {
      return [];
    }

    const products = await this.shopifyClient.fetchProducts();
    const snapshots = products.flatMap((product) =>
      mapShopifyProductSnapshots(product),
    );

    const duplicateSkus = this.findDuplicateSkus(snapshots);

    for (const snapshot of snapshots) {
      if (duplicateSkus.has(snapshot.sku)) {
        continue;
      }

      const data = this.toShopifyData(snapshot);
      await this.prisma.shopifyProduct.upsert({
        where: { sku: snapshot.sku },
        create: data,
        update: data,
      });
    }

    return snapshots;
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }

  private findDuplicateSkus(snapshots: PlatformProductSnapshot[]): Set<string> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const snapshot of snapshots) {
      if (seen.has(snapshot.sku)) {
        duplicates.add(snapshot.sku);
      }
      seen.add(snapshot.sku);
    }

    return duplicates;
  }

  private toSapoData(
    snapshot: PlatformProductSnapshot,
  ): Prisma.SapoProductUncheckedCreateInput {
    return {
      sku: snapshot.sku,
      productId: snapshot.productId,
      variantId: snapshot.variantId,
      name: snapshot.name,
      available: snapshot.available,
      remain: snapshot.remain,
      retailPrice: snapshot.retailPrice,
      sourceUpdatedAt: snapshot.sourceUpdatedAt ?? null,
      updatedBy: 'SAPO',
    };
  }

  private toPancakeData(
    snapshot: PlatformProductSnapshot,
  ): Prisma.PancakeProductUncheckedCreateInput {
    return {
      sku: snapshot.sku,
      productId: snapshot.productId,
      variantId: snapshot.variantId,
      name: snapshot.name,
      available: snapshot.available,
      remain: snapshot.remain,
      retailPrice: snapshot.retailPrice,
      warehouseId: snapshot.warehouseId,
      updatedBy: 'PANCAKE',
    };
  }

  private toShopifyData(
    snapshot: PlatformProductSnapshot,
  ): Prisma.ShopifyProductUncheckedCreateInput {
    return {
      sku: snapshot.sku,
      productId: snapshot.productId,
      variantId: snapshot.variantId,
      name: snapshot.name,
      available:
        snapshot.available === null ? null : BigInt(snapshot.available),
      remain: snapshot.remain === null ? null : BigInt(snapshot.remain),
      retailPrice: snapshot.retailPrice,
      updatedBy: 'SHOPIFY',
    };
  }
}
