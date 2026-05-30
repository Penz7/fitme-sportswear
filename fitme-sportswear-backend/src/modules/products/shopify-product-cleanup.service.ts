import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ShopifyClient } from '../shopify/shopify.client';

@Injectable()
export class ShopifyProductCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyClient: ShopifyClient,
  ) {}

  async cleanupEmptyProducts() {
    const rows = await this.prisma.shopifyProduct.findMany();
    const result = {
      checked: rows.length,
      deletedRemote: 0,
      deletedLocal: 0,
      kept: 0,
      errors: [] as Array<{ productId: string | null; message: string }>,
    };

    for (const row of rows) {
      try {
        if (!row.productId) {
          await this.prisma.shopifyProduct.delete({ where: { id: row.id } });
          result.deletedLocal += 1;
          continue;
        }

        const product = await this.shopifyClient.fetchProduct(row.productId);

        if (!product) {
          await this.prisma.shopifyProduct.delete({ where: { id: row.id } });
          result.deletedLocal += 1;
          continue;
        }

        if (this.isEmptyGeneratedProduct(product)) {
          await this.shopifyClient.deleteProduct(row.productId);
          await this.prisma.shopifyProduct.delete({ where: { id: row.id } });
          result.deletedRemote += 1;
          result.deletedLocal += 1;
          continue;
        }

        result.kept += 1;
      } catch (error) {
        result.errors.push({
          productId: row.productId,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  private isEmptyGeneratedProduct(product: Record<string, any>): boolean {
    const images = Array.isArray(product.images) ? product.images : [];
    const tags = product.tags === null || product.tags === undefined
      ? ''
      : String(product.tags);

    return images.length === 0 && tags.trim() === '';
  }
}
