import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';
import { ORDER_TYPE_MAPPINGS, OrderTypeMapping } from './order-status.mapper';
import { SapoToPancakeOrderSyncService } from './sapo-to-pancake-order-sync.service';

export interface SapoTopOrderSyncInput {
  orderType: string;
  prefix?: string;
  limit?: number;
}

export interface SapoTopOrderSyncResult {
  orderType: string;
  prefix: string;
  fetched: number;
  processed: number;
  skippedTracked: number;
  results: Array<{
    action: 'created' | 'updated' | 'skipped';
    sapoOrderId: string | null;
    pancakeOrderId: string | null;
  }>;
}

@Injectable()
export class SapoTopOrderSyncService {
  private readonly defaultPrefix = 'AUTO_PANCAKE';
  private readonly defaultLimit = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly orderSyncService: SapoToPancakeOrderSyncService,
    private readonly shopifyClient: ShopifyClient,
  ) {}

  async syncAllPancakeOrderTypes(input: { limit?: number } = {}) {
    const orderTypes = [];

    for (const mapping of ORDER_TYPE_MAPPINGS) {
      orderTypes.push(
        await this.syncOrderType({
          orderType: mapping.key,
          prefix: this.defaultPrefix,
          limit: input.limit,
        }),
      );
    }

    return {
      prefix: this.defaultPrefix,
      orderTypes,
      fetched: orderTypes.reduce((total, result) => total + result.fetched, 0),
      processed: orderTypes.reduce((total, result) => total + result.processed, 0),
      skippedTracked: orderTypes.reduce(
        (total, result) => total + result.skippedTracked,
        0,
      ),
    };
  }

  async syncOrderType(input: SapoTopOrderSyncInput): Promise<SapoTopOrderSyncResult> {
    const mapping = this.findMapping(input.orderType);
    const prefix = input.prefix ?? this.defaultPrefix;
    const trackingType = `${mapping.key}_${prefix}`;
    const response = await this.sapoClient.fetchOrders({
      page: 1,
      limit: input.limit ?? this.defaultLimit,
      status: mapping.sapoStatuses[0]?.value,
    });
    const orders = (response.orders ?? []).filter((order) =>
      this.matchesMapping(order, mapping),
    );
    const currentIds = orders.map((order) => String(order.id));
    const tracked = await this.sapoOrderTracking.findUnique({
      where: { type: trackingType },
    });
    const trackedIds = new Set(this.stringArray(tracked?.orderIds));
    const newOrders = orders.filter((order) => !trackedIds.has(String(order.id)));
    const results = [];

    for (const order of newOrders) {
      results.push(await this.processOrder(order, mapping.key, prefix));
    }

    await this.sapoOrderTracking.upsert({
      where: { type: trackingType },
      create: {
        type: trackingType,
        orderIds: currentIds,
        lastUpdate: new Date(),
      },
      update: {
        orderIds: currentIds,
        lastUpdate: new Date(),
      },
    });

    return {
      orderType: mapping.key,
      prefix,
      fetched: currentIds.length,
      processed: newOrders.length,
      skippedTracked: currentIds.length - newOrders.length,
      results,
    };
  }

  private async processOrder(
    order: Record<string, any>,
    orderType: string,
    prefix: string,
  ) {
    const sapoOrderId = this.stringOrNull(order.id);

    if (prefix === 'AUTO_SHOPIFY') {
      if (orderType === 'CANCELED' && sapoOrderId) {
        const mapping = await this.orderMapping.findFirst({
          where: { sapoOrderId },
        });
        if (mapping?.shopifyOrderId) {
          await this.shopifyClient.cancelOrder(
            mapping.shopifyOrderId,
            'Cancelled by Sapo',
          );
          return {
            action: 'updated' as const,
            sapoOrderId,
            pancakeOrderId: null,
          };
        }
      }

      return {
        action: 'skipped' as const,
        sapoOrderId,
        pancakeOrderId: null,
      };
    }

    return this.orderSyncService.syncSapoOrder(order);
  }

  private findMapping(orderType: string): OrderTypeMapping {
    const mapping = ORDER_TYPE_MAPPINGS.find(
      (candidate) => candidate.key === orderType,
    );

    if (!mapping) {
      throw new Error(`Unsupported Sapo order type: ${orderType}`);
    }

    return mapping;
  }

  private matchesMapping(order: Record<string, any>, mapping: OrderTypeMapping): boolean {
    return mapping.sapoStatuses.every(
      (status) => String(order[status.field] ?? '') === status.value,
    );
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .filter((item) => item !== null && item !== undefined)
          .map((item) => String(item))
      : [];
  }

  private stringOrNull(value: unknown): string | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    return String(value);
  }

  private get sapoOrderTracking() {
    return (this.prisma as any).sapoOrderTracking;
  }

  private get orderMapping() {
    return (this.prisma as any).orderMapping;
  }
}
