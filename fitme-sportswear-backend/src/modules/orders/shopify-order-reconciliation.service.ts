import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';
import { OrderWebhookExecutionService } from './order-webhook-execution.service';
import { OrderWebhookProcessingService } from './order-webhook-processing.service';

export interface ShopifyOrderReconciliationResult {
  checked: number;
  cancelledSapo: number;
  expiredUnpaidPreorders: number;
  activatedPreorders: number;
  skipped: number;
  errors: Array<{ shopifyOrderId: string; sapoOrderId: string | null; message: string }>;
}

const PREORDER_UNPAID_EXPIRY_MS = 45 * 60 * 1000;
const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 17;

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
    @Optional()
    private readonly orderWebhookProcessingService?: OrderWebhookProcessingService,
    @Optional()
    private readonly orderWebhookExecutionService?: OrderWebhookExecutionService,
  ) {}

  async reconcile(input: { limit?: number } = {}): Promise<ShopifyOrderReconciliationResult> {
    const limit = this.reconcileLimit(input.limit);
    const result: ShopifyOrderReconciliationResult = {
      checked: 0,
      cancelledSapo: 0,
      expiredUnpaidPreorders: 0,
      activatedPreorders: 0,
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

    await this.reconcilePendingPreorders(limit, result);

    return result;
  }

  /**
   * Webhooks normally promote a manual-payment PreOrder immediately after
   * staff marks it paid. This small reconciliation pass is the safety net for
   * a delayed or lost orders/updated webhook.
   */
  private async reconcilePendingPreorders(
    limit: number,
    result: ShopifyOrderReconciliationResult,
  ): Promise<void> {
    if (!this.orderWebhookProcessingService || !this.orderWebhookExecutionService) {
      return;
    }

    const pendingMappings = await (this.prisma as any).orderMapping.findMany({
      where: {
        shopifyStatus: 'PREORDER_PENDING_PAYMENT',
        shopifyOrderId: { not: null },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    for (const mapping of pendingMappings ?? []) {
      const shopifyOrderId = String(mapping.shopifyOrderId);
      result.checked += 1;
      try {
        const order = await this.shopifyClient.fetchOrder(shopifyOrderId);
        if (!order) {
          throw new Error(`Shopify pending preorder ${shopifyOrderId} was not found`);
        }
        if (this.shouldExpireUnpaidPreorder(order)) {
          await this.shopifyClient.cancelOrder(shopifyOrderId, 'other');
          const cancelledOrder = {
            ...order,
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'other',
          };
          const plan = this.orderWebhookProcessingService.buildProcessingPlan({
            sourcePlatform: 'shopify',
            eventType: 'orders/cancelled',
            externalEventId: shopifyOrderId,
            payload: cancelledOrder,
          });
          await this.orderWebhookExecutionService.executePlan(plan, cancelledOrder);
          result.expiredUnpaidPreorders += 1;
          continue;
        }
        const plan = this.orderWebhookProcessingService.buildProcessingPlan({
          sourcePlatform: 'shopify',
          eventType: this.isCancelled(order) ? 'orders/cancelled' : 'orders/updated',
          externalEventId: shopifyOrderId,
          payload: order,
        });
        await this.orderWebhookExecutionService.executePlan(plan, order);
        if (this.isPaid(order)) {
          result.activatedPreorders += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors.push({
          shopifyOrderId,
          sapoOrderId: null,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
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

  private isPaid(order: Record<string, any> | null): boolean {
    const status = String(order?.financial_status ?? order?.financialStatus ?? '').toLowerCase();
    return status === 'paid';
  }

  private shouldExpireUnpaidPreorder(order: Record<string, any>): boolean {
    if (this.isCancelled(order) || this.isPaid(order) || this.isFulfilled(order)) {
      return false;
    }

    const financialStatus = String(
      order.financial_status ?? order.financialStatus ?? '',
    ).toLowerCase();
    if (!['pending', 'unpaid'].includes(financialStatus)) {
      return false;
    }

    const createdAt = new Date(order.created_at ?? order.createdAt ?? '');
    return (
      Number.isFinite(createdAt.getTime()) &&
      Date.now() >= this.unpaidPreorderExpiryAt(createdAt).getTime()
    );
  }

  /**
   * The payment window never spans an off period. If fewer than 45 minutes
   * remain before 17:00, the customer receives a fresh window from 08:00 on
   * the next working day. Saturday and Sunday are both non-working days.
   */
  private unpaidPreorderExpiryAt(createdAt: Date): Date {
    const local = this.vietnamDateParts(createdAt);
    const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
    const businessStart = this.vietnamTime(local, BUSINESS_START_HOUR, 0);
    const businessEnd = this.vietnamTime(local, BUSINESS_END_HOUR, 0);
    const withinBusinessWindow =
      this.isBusinessDay(localDate) &&
      createdAt.getTime() >= businessStart.getTime() &&
      createdAt.getTime() + PREORDER_UNPAID_EXPIRY_MS <= businessEnd.getTime();

    if (withinBusinessWindow) {
      return new Date(createdAt.getTime() + PREORDER_UNPAID_EXPIRY_MS);
    }

    const nextStartDate =
      this.isBusinessDay(localDate) && createdAt.getTime() < businessStart.getTime()
        ? localDate
        : this.nextBusinessDay(localDate);
    const nextLocal = {
      year: nextStartDate.getUTCFullYear(),
      month: nextStartDate.getUTCMonth() + 1,
      day: nextStartDate.getUTCDate(),
    };
    return this.vietnamTime(nextLocal, BUSINESS_START_HOUR, 45);
  }

  private nextBusinessDay(date: Date): Date {
    const candidate = new Date(date.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + 1);
    while (!this.isBusinessDay(candidate)) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate;
  }

  private isBusinessDay(date: Date): boolean {
    const day = date.getUTCDay();
    return day >= 1 && day <= 5;
  }

  private vietnamDateParts(value: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const part = (type: 'year' | 'month' | 'day') =>
      Number(parts.find((item) => item.type === type)?.value ?? NaN);
    return { year: part('year'), month: part('month'), day: part('day') };
  }

  private vietnamTime(
    date: { year: number; month: number; day: number },
    hour: number,
    minute: number,
  ): Date {
    // Vietnam has a fixed UTC+7 offset and no DST, so this produces an
    // unambiguous instant while all business-day calculations stay in ICT.
    return new Date(Date.UTC(date.year, date.month - 1, date.day, hour - 7, minute));
  }

  private isFulfilled(order: Record<string, any>): boolean {
    return Boolean(order.fulfillment_status ?? order.fulfillmentStatus);
  }

  private reconcileLimit(limit: number | undefined): number {
    return Math.min(Math.max(limit ?? 100, 50), 250);
  }
}
