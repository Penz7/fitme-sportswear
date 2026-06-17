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

@Injectable()
export class ShopifyOrderReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopifyClient: ShopifyClient,
    private readonly sapoClient: SapoClient,
  ) {}

  async reconcile(input: { limit?: number } = {}): Promise<ShopifyOrderReconciliationResult> {
    const mappings = await (this.prisma as any).orderMapping.findMany({
      where: {
        shopifyOrderId: { not: null },
        sapoOrderId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: input.limit ?? 50,
    });
    const result: ShopifyOrderReconciliationResult = {
      checked: mappings.length,
      cancelledSapo: 0,
      skipped: 0,
      errors: [],
    };

    for (const mapping of mappings) {
      const shopifyOrderId = String(mapping.shopifyOrderId);
      const sapoOrderId = mapping.sapoOrderId ? String(mapping.sapoOrderId) : null;

      if (!sapoOrderId) {
        result.skipped += 1;
        continue;
      }

      try {
        const shopifyOrder = await this.shopifyClient.fetchOrder(shopifyOrderId);
        if (!this.isCancelled(shopifyOrder)) {
          result.skipped += 1;
          continue;
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

    return result;
  }

  private isCancelled(order: Record<string, any> | null): boolean {
    if (!order) {
      return false;
    }

    return Boolean(order.cancelled_at ?? order.cancelledAt ?? order.cancel_reason ?? order.cancelReason);
  }
}
