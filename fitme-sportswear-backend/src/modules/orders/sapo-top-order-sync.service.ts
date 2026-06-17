import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    action: 'created' | 'updated' | 'skipped' | 'failed';
    sapoOrderId: string | null;
    pancakeOrderId: string | null;
    error?: string;
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
    private readonly configService: ConfigService,
  ) {}

  async syncAllPancakeOrderTypes(input: { limit?: number } = {}) {
    return this.syncAllOrderTypes({ ...input, prefix: this.defaultPrefix });
  }

  async syncAllOrderTypes(input: { limit?: number; prefix?: string } = {}) {
    const orderTypes = [];
    const prefix = input.prefix ?? this.defaultPrefix;

    for (const mapping of ORDER_TYPE_MAPPINGS) {
      orderTypes.push(
        await this.syncOrderType({
          orderType: mapping.key,
          prefix,
          limit: input.limit,
        }),
      );
    }

    return {
      prefix,
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
      results.push(await this.processOrderSafely(order, mapping.key, prefix));
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

  private async processOrderSafely(
    order: Record<string, any>,
    orderType: string,
    prefix: string,
  ) {
    try {
      return await this.processOrder(order, orderType, prefix);
    } catch (error) {
      const sapoOrderId = this.stringOrNull(order.id);
      const mapping = sapoOrderId
        ? await this.orderMapping.findFirst({ where: { sapoOrderId } })
        : null;

      return {
        action: 'failed' as const,
        sapoOrderId,
        pancakeOrderId: this.stringOrNull(mapping?.pancakeOrderId),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async processOrder(
    order: Record<string, any>,
    orderType: string,
    prefix: string,
  ) {
    const sapoOrderId = this.stringOrNull(order.id);

    if (prefix === 'AUTO_SHOPIFY') {
      return this.processShopifyOrder(order, orderType, sapoOrderId);
    }

    if (!sapoOrderId) {
      return this.skippedPancakeResult(sapoOrderId);
    }

    if (!this.hasOrderCodePrefix(order, `${prefix}_`)) {
      const mapping = await this.orderMapping.findFirst({
        where: { sapoOrderId },
      });

      if (!mapping?.pancakeOrderId) {
        return this.skippedPancakeResult(sapoOrderId);
      }
    }

    return this.orderSyncService.syncSapoOrder(order);
  }

  private async processShopifyOrder(
    order: Record<string, any>,
    orderType: string,
    sapoOrderId: string | null,
  ) {
    if (!sapoOrderId) {
      return this.skippedShopifyResult(sapoOrderId);
    }

    const mapping = await this.orderMapping.findFirst({
      where: { sapoOrderId },
    });
    if (!mapping?.shopifyOrderId) {
      return this.skippedShopifyResult(sapoOrderId);
    }

    const shopifyOrderId = String(mapping.shopifyOrderId);
    const shopifyOrder = await this.shopifyClient.fetchOrder(shopifyOrderId);
    if (!shopifyOrder) {
      await this.updateShopifyMapping(mapping.id, order, 'MISSING');
      return this.skippedShopifyResult(sapoOrderId);
    }

    let updated = false;
    if (orderType === 'CANCELED') {
      if (!this.isShopifyCancelled(shopifyOrder)) {
        await this.shopifyClient.cancelOrder(shopifyOrderId, 'Cancelled by Sapo');
        updated = true;
      }
      await this.updateShopifyMapping(mapping.id, order, 'CANCELLED');
      return this.shopifyResult(updated ? 'updated' : 'skipped', sapoOrderId);
    }

    if (this.shouldCreateShopifyFulfillment(orderType, shopifyOrder)) {
      const trackingNumber = this.sapoTrackingNumber(order);
      if (trackingNumber) {
        await this.shopifyClient.createFulfillment({
          orderId: shopifyOrderId,
          trackingCompany: this.configString(
            'shipping.viettelPost.trackingCompany',
            'Viettel',
          ),
          trackingNumber,
          notifyCustomer: true,
          lineItems: this.shopifyLineItems(shopifyOrder),
        });
        updated = true;
      }
    }

    if (
      this.shouldCloseShopifyOrder(orderType, shopifyOrder) &&
      !this.isShopifyCancelled(shopifyOrder)
    ) {
      await this.shopifyClient.closeOrder(shopifyOrderId);
      updated = true;
    }

    await this.updateShopifyMapping(
      mapping.id,
      order,
      this.shopifyStatusForOrderType(orderType, shopifyOrder),
    );

    return this.shopifyResult(updated ? 'updated' : 'skipped', sapoOrderId);
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

  private shouldCreateShopifyFulfillment(
    orderType: string,
    shopifyOrder: Record<string, any>,
  ): boolean {
    if (!['SHIPPED', 'RECEIVED', 'COMPLETED'].includes(orderType)) {
      return false;
    }

    if (this.isShopifyCancelled(shopifyOrder)) {
      return false;
    }

    const fulfillmentStatus = String(
      shopifyOrder.fulfillment_status ?? shopifyOrder.fulfillmentStatus ?? '',
    ).toLowerCase();
    return fulfillmentStatus !== 'fulfilled';
  }

  private shouldCloseShopifyOrder(
    orderType: string,
    shopifyOrder: Record<string, any>,
  ): boolean {
    if (!['RECEIVED', 'COMPLETED'].includes(orderType)) {
      return false;
    }

    return !this.firstString(shopifyOrder.closed_at, shopifyOrder.closedAt);
  }

  private sapoTrackingNumber(order: Record<string, any>): string | null {
    return this.firstString(
      ...this.arrayPayload(order.fulfillments).map((fulfillment) => {
        const shipment = this.objectPayload(fulfillment.shipment);
        return this.firstString(shipment.tracking_code, shipment.trackingCode);
      }),
    );
  }

  private shopifyLineItems(
    shopifyOrder: Record<string, any>,
  ): Array<{ id: string | number; quantity: number }> {
    return this.arrayPayload(shopifyOrder.line_items ?? shopifyOrder.lineItems)
      .map((lineItem) => ({
        id: lineItem.id,
        quantity: Number(lineItem.quantity ?? 0),
      }))
      .filter((lineItem) => lineItem.id !== undefined && lineItem.quantity > 0);
  }

  private isShopifyCancelled(shopifyOrder: Record<string, any>): boolean {
    return Boolean(
      shopifyOrder.cancelled_at ??
        shopifyOrder.cancelledAt ??
        shopifyOrder.cancel_reason ??
        shopifyOrder.cancelReason,
    );
  }

  private shopifyStatusForOrderType(
    orderType: string,
    shopifyOrder: Record<string, any>,
  ): string {
    if (orderType === 'CANCELED' || this.isShopifyCancelled(shopifyOrder)) {
      return 'CANCELLED';
    }

    if (['RECEIVED', 'COMPLETED'].includes(orderType)) {
      return 'CLOSED';
    }

    if (orderType === 'SHIPPED') {
      return 'FULFILLED';
    }

    if (orderType === 'PAID') {
      return 'PAID';
    }

    if (orderType === 'PACKED') {
      return 'PACKED';
    }

    if (orderType === 'APPROVED') {
      return 'OPEN';
    }

    return orderType;
  }

  private async updateShopifyMapping(
    mappingId: string,
    sapoOrder: Record<string, any>,
    shopifyStatus: string,
  ): Promise<void> {
    await this.orderMapping.update({
      where: { id: mappingId },
      data: {
        shopifyStatus,
        sapoStatus: sapoOrder.status ?? undefined,
        sapoPackedStatus: sapoOrder.packed_status ?? undefined,
        sapoFulfillmentStatus: sapoOrder.fulfillment_status ?? undefined,
        sapoReceivedStatus: sapoOrder.received_status ?? undefined,
        sapoPaymentStatus: sapoOrder.payment_status ?? undefined,
        sapoReturnStatus: sapoOrder.return_status ?? undefined,
      },
    });
  }

  private shopifyResult(
    action: 'updated' | 'skipped',
    sapoOrderId: string | null,
  ) {
    return {
      action,
      sapoOrderId,
      pancakeOrderId: null,
    };
  }

  private skippedShopifyResult(sapoOrderId: string | null) {
    return this.shopifyResult('skipped', sapoOrderId);
  }

  private skippedPancakeResult(sapoOrderId: string | null) {
    return {
      action: 'skipped' as const,
      sapoOrderId,
      pancakeOrderId: null,
    };
  }

  private hasOrderCodePrefix(
    order: Record<string, any>,
    prefix: string,
  ): boolean {
    const code = this.firstString(order.code, order.order_code, order.orderCode);
    return Boolean(code?.startsWith(prefix));
  }

  private objectPayload(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private arrayPayload(value: unknown): Record<string, any>[] {
    return Array.isArray(value) ? (value as Record<string, any>[]) : [];
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value).trim();
      }
    }

    return null;
  }

  private configString(key: string, fallback: string): string {
    const value = this.configService.get<string | undefined>(key);
    return value === undefined || value === null || String(value).trim() === ''
      ? fallback
      : String(value);
  }

  private get sapoOrderTracking() {
    return (this.prisma as any).sapoOrderTracking;
  }

  private get orderMapping() {
    return (this.prisma as any).orderMapping;
  }
}
