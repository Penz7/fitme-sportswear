import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PancakeClient } from '../pancake/pancake.client';
import { ShopifyClient } from '../shopify/shopify.client';
import { ProductMappingCandidate } from './types/platform-product-snapshot';

export interface ProductSyncError {
  sku: string;
  platform: 'pancake' | 'shopify';
  operation: string;
  message: string;
}

export interface InventorySyncResult {
  updatedPancake: number;
  updatedShopify: number;
  errors: ProductSyncError[];
}

@Injectable()
export class InventorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pancakeClient: PancakeClient,
    private readonly shopifyClient: ShopifyClient,
  ) {}

  async syncMappings(
    mappings: ProductMappingCandidate[],
  ): Promise<InventorySyncResult> {
    const result: InventorySyncResult = {
      updatedPancake: 0,
      updatedShopify: 0,
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

      if (mapping.pancake?.variantId) {
        try {
          await this.pancakeClient.updateInventory({
            variantId: mapping.pancake.variantId,
            warehouseId: mapping.pancake.warehouseId,
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

      if (mapping.shopify?.variantId) {
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
}
