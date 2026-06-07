import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { PancakeClient } from '../pancake/pancake.client';
import { ShopifyClient } from '../shopify/shopify.client';
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
  errors: ProductSyncError[];
}

@Injectable()
export class InventorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pancakeClient: PancakeClient,
    private readonly shopifyClient: ShopifyClient,
    private readonly configService: ConfigService,
  ) {}

  async syncMappings(
    mappings: ProductMappingCandidate[],
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      updatedPancake: 0,
      updatedShopify: 0,
      createdPancake: 0,
      createdShopify: 0,
      errors: [],
    };

    for (const mapping of mappings) {
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

      if (!mapping.pancake?.variantId && this.createMissingPancakeProducts()) {
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
          } else {
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
        } catch (error) {
          result.errors.push(
            this.toError(
              mapping.sku,
              'shopify',
              'updateInventoryAndPrice',
              error,
            ),
          );
        }
      }

      if (!mapping.shopify?.variantId && this.createMissingShopifyProducts()) {
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
        } catch (error) {
          result.errors.push(
            this.toError(mapping.sku, 'shopify', 'createProductFromSapo', error),
          );
        }
      }
    }

    return result;
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

  private createMissingPancakeProducts(): boolean {
    return this.configBoolean('sync.products.createMissingPancake', true);
  }

  private createMissingShopifyProducts(): boolean {
    return this.configBoolean('sync.products.createMissingShopify', false);
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }
}
