import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';

export interface ShopifyOrderReconciliationResult {
  checked: number;
  cancelledSapo: number;
  skipped: number;
  errors: Array<{ shopifyOrderId: string; sapoOrderId: string | null; message: string }>;
}

type OrderMappingLike = {
  id: string;
  shopifyOrderId: string | number | null;
  sapoOrderId: string | number | null;
  sapoStatus?: string | null;
};

@Injectable()
export class ShopifyOrderReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyClient: ShopifyClient,
    private readonly sapoClient: SapoClient,
  ) {}

  async reconcile(input: { limit?: number } = {}): Promise<ShopifyOrderReconciliationResult> {
    const limit = this.reconcileLimit(input.limit);
    const result: ShopifyOrderReconciliationResult = {
      checked: 0,
      cancelledSapo: 0,
      skipped: 0,
      errors: [],
    };
    const processedMappingIds = new Set<string>();

    if (typeof (this.shopifyClient as any).fetchRecentOrders === 'function') {
      const shopifyOrders = await (this.shopifyClient as any).fetchRecentOrders({
        limit,
        status: 'any',
      });
      const shopifyOrderById = new Map(
        shopifyOrders.map((order: Record<string, any>) => [String(order.id), order]),
      );
      const shopifyOrderIds = [...shopifyOrderById.keys()];
      const mappedRecentOrders =
        shopifyOrderIds.length === 0
          ? []
          : await (this.prisma as any).orderMapping.findMany({
              where: {
                shopifyOrderId: { in: shopifyOrderIds },
                sapoOrderId: { not: null },
              },
            });

      for (const mapping of mappedRecentOrders) {
        await this.reconcileMapping(
          mapping,
          shopifyOrderById.get(String(mapping.shopifyOrderId)) ?? null,
          result,
        );
        processedMappingIds.add(String(mapping.id));
      }
    }

    const mappings = await (this.prisma as any).orderMapping.findMany({
      where: {
        shopifyOrderId: { not: null },
        sapoOrderId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    for (const mapping of mappings) {
      if (processedMappingIds.has(String(mapping.id))) {
        continue;
      }
      await this.reconcileMapping(mapping, null, result);
    }

    return result;
  }

  private async reconcileMapping(
    mapping: OrderMappingLike,
    knownShopifyOrder: Record<string, any> | null,
    result: ShopifyOrderReconciliationResult,
  ): Promise<void> {
    const shopifyOrderId = String(mapping.shopifyOrderId);
    const sapoOrderId = mapping.sapoOrderId ? String(mapping.sapoOrderId) : null;
    result.checked += 1;

    if (!sapoOrderId) {
      result.skipped += 1;
      return;
    }

    try {
      const shopifyOrder =
        knownShopifyOrder ?? (await this.shopifyClient.fetchOrder(shopifyOrderId));
      if (!this.isCancelled(shopifyOrder)) {
        result.skipped += 1;
        return;
      }

      if (mapping.sapoStatus !== 'cancelled') {
        await this.sapoClient.cancelOrder(sapoOrderId, {
          tolerateIdempotent422: true,
        });
      }
      await (this.prisma as any).orderMapping.update({
        where: { id: mapping.id },
        data: {
          shopifyStatus: 'CANCELLED',
          sapoStatus: 'cancelled',
        },
      });
      result.cancelledSapo += 1;
    } catch (error) {
      result.errors.push({
        shopifyOrderId,
        sapoOrderId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isCancelled(order: Record<string, any> | null): boolean {
    if (!order) {
      return false;
    }

    return Boolean(order.cancelled_at ?? order.cancelledAt ?? order.cancel_reason ?? order.cancelReason);
  }

  private reconcileLimit(limit: number | undefined): number {
    return Math.min(Math.max(limit ?? 100, 50), 250);
  }
}
