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
  private readonly shopifyRecoveryLimit = 50;

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
    const ordersToProcess =
      prefix === 'AUTO_SHOPIFY'
        ? await this.autoShopifyOrdersToProcess(
            orders,
            trackedIds,
            mapping.key,
          )
        : newOrders;
    const recoveryOrders =
      prefix === 'AUTO_SHOPIFY' && mapping.key === 'SHIPPED'
        ? await this.recoverOpenShopifyOrdersOutsideListing(ordersToProcess)
        : [];
    const ordersForProcessing = [
      ...ordersToProcess,
      ...recoveryOrders,
    ];
    const results = [];

    for (const order of ordersForProcessing) {
      const recoveredOrderType =
        prefix === 'AUTO_SHOPIFY'
          ? this.shopifyRecoveryOrderType(order) ?? mapping.key
          : mapping.key;
      results.push(
        await this.processOrderSafely(order, recoveredOrderType, prefix),
      );
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
      processed: ordersForProcessing.length,
      skippedTracked: currentIds.length - ordersToProcess.length,
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
    let fulfilled = false;
    if (orderType === 'CANCELED') {
      if (!this.isShopifyCancelled(shopifyOrder)) {
        await this.shopifyClient.cancelOrder(shopifyOrderId, 'Cancelled by Sapo');
        updated = true;
      }
      await this.updateShopifyMapping(mapping.id, order, 'CANCELLED');
      return this.shopifyResult(updated ? 'updated' : 'skipped', sapoOrderId);
    }

    const trackingNumber = this.sapoTrackingNumber(order);
    const fulfillmentIdToCorrect = trackingNumber
      ? this.shopifyFulfillmentIdNeedingTrackingCorrection(
          shopifyOrder,
          trackingNumber,
        )
      : null;
    if (fulfillmentIdToCorrect) {
      await this.shopifyClient.updateFulfillmentTracking({
        fulfillmentId: fulfillmentIdToCorrect,
        trackingCompany: this.configString(
          'shipping.viettelPost.trackingCompany',
          'Viettel',
        ),
        trackingNumber: trackingNumber as string,
        // The customer was already notified when the original fulfillment was
        // created. Correct the record without sending a duplicate email.
        notifyCustomer: false,
      });
      updated = true;
      fulfilled = true;
    } else if (
      this.shouldCreateShopifyFulfillment(orderType, shopifyOrder, trackingNumber)
    ) {
      const fulfillmentCreated = await this.shopifyClient.createFulfillment({
        orderId: shopifyOrderId,
        ...(trackingNumber
          ? {
              trackingCompany: this.configString(
                'shipping.viettelPost.trackingCompany',
                'Viettel',
              ),
              trackingNumber,
            }
          : {}),
        // A completed Sapo order without a shipment record must still be
        // reflected as fulfilled, but must never trigger a misleading
        // shipping notification with no real tracking number.
        notifyCustomer: Boolean(trackingNumber),
        lineItems: this.shopifyLineItems(shopifyOrder),
      });
      updated = fulfillmentCreated;
      fulfilled = fulfillmentCreated;
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
      fulfilled
        ? 'FULFILLED'
        : this.shopifyStatusForOrderType(orderType, shopifyOrder, order),
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

  /**
   * The Sapo orders-list endpoint does not reliably include fulfillment and
   * shipment details. For already tracked Shopify orders that still have not
   * been fulfilled, fetch the individual Sapo order before deciding whether a
   * completed Viettel Post tracking number is available.
   */
  private async autoShopifyOrdersToProcess(
    orders: Record<string, any>[],
    trackedIds: Set<string>,
    orderType: string,
  ): Promise<Record<string, any>[]> {
    const newOrders = orders.filter((order) => !trackedIds.has(String(order.id)));
    if (orderType === 'CANCELED') {
      return newOrders;
    }

    const trackedOrdersWithShipment = orders.filter(
      (order) =>
        trackedIds.has(String(order.id)) &&
        this.sapoTrackingNumber(order) !== null,
    );
    const trackedOrdersWithShipmentIds = new Set(
      trackedOrdersWithShipment.map((order) => String(order.id)),
    );

    const orderIdsNeedingDetail = orders
      .filter(
        (order) =>
          !trackedOrdersWithShipmentIds.has(String(order.id)),
      )
      .map((order) => String(order.id));
    if (orderIdsNeedingDetail.length === 0) {
      return [...newOrders, ...trackedOrdersWithShipment];
    }

    const mappings = await this.orderMapping.findMany({
      where: {
        sapoOrderId: { in: orderIdsNeedingDetail },
        shopifyOrderId: { not: null },
        OR: [
          { shopifyStatus: null },
          { shopifyStatus: { notIn: ['FULFILLED', 'CANCELLED'] } },
        ],
      },
      select: { sapoOrderId: true },
    });
    const recoveryIds = new Set(
      mappings
        .map((mapping: { sapoOrderId?: string | null }) => mapping.sapoOrderId)
        .filter((orderId: string | null | undefined): orderId is string =>
          Boolean(orderId),
        ),
    );

    const recoveredOrders: Record<string, any>[] = [];
    for (const orderId of orderIdsNeedingDetail) {
      if (!recoveryIds.has(orderId)) {
        continue;
      }

      try {
        const response = await this.sapoClient.fetchOrder(orderId);
        if (response.order) {
          recoveredOrders.push(response.order as Record<string, any>);
        }
      } catch {
        // A transient detail-fetch failure must not turn a known order into a
        // state update based on the incomplete list payload. It will retry on
        // the next scheduled run.
      }
    }

    const recoveredOrderIds = new Set(
      recoveredOrders.map((order) => String(order.id)),
    );
    return [
      ...newOrders.filter(
        (order) => !recoveredOrderIds.has(String(order.id)),
      ),
      ...trackedOrdersWithShipment,
      ...recoveredOrders,
    ];
  }

  /**
   * The Sapo list API is page based, whereas the scheduled top-order job only
   * receives its newest page. Recover a bounded set of mapped Shopify orders
   * that remain open directly by ID so a shipment cannot be lost merely
   * because newer finalized Sapo orders pushed it off that page.
   */
  private async recoverOpenShopifyOrdersOutsideListing(
    listedOrders: Record<string, any>[],
  ): Promise<Record<string, any>[]> {
    const listedIds = new Set(listedOrders.map((order) => String(order.id)));
    const mappings = await this.orderMapping.findMany({
      where: {
        sapoOrderId: { not: null },
        shopifyOrderId: { not: null },
        OR: [
          { shopifyStatus: null },
          { shopifyStatus: { notIn: ['FULFILLED', 'CANCELLED', 'MISSING'] } },
        ],
      },
      select: { sapoOrderId: true },
      orderBy: { updatedAt: 'desc' },
      take: this.shopifyRecoveryLimit,
    });

    const recoveredOrders: Record<string, any>[] = [];
    for (const mapping of mappings) {
      const sapoOrderId = this.stringOrNull(mapping.sapoOrderId);
      if (!sapoOrderId || listedIds.has(sapoOrderId)) {
        continue;
      }

      try {
        const response = await this.sapoClient.fetchOrder(sapoOrderId);
        if (response.order) {
          recoveredOrders.push(response.order as Record<string, any>);
        }
      } catch {
        // Keep the mapping open. The next one-minute recovery run retries it.
      }
    }

    return recoveredOrders;
  }

  private shopifyRecoveryOrderType(order: Record<string, any>): string | null {
    if (String(order.status ?? '').toLowerCase() === 'cancelled') {
      return 'CANCELED';
    }
    if (String(order.status ?? '').toLowerCase() === 'completed') {
      return 'COMPLETED';
    }
    if (String(order.fulfillment_status ?? '').toLowerCase() === 'shipped') {
      return 'SHIPPED';
    }
    return null;
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
    trackingNumber: string | null,
  ): boolean {
    if (orderType === 'CANCELED') {
      return false;
    }

    if (this.isShopifyCancelled(shopifyOrder)) {
      return false;
    }

    const fulfillmentStatus = String(
      shopifyOrder.fulfillment_status ?? shopifyOrder.fulfillmentStatus ?? '',
    ).toLowerCase();
    if (fulfillmentStatus === 'fulfilled') {
      return false;
    }

    return Boolean(trackingNumber) || orderType === 'COMPLETED';
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

  private shopifyFulfillmentIdNeedingTrackingCorrection(
    shopifyOrder: Record<string, any>,
    trackingNumber: string,
  ): string | null {
    const fulfillmentStatus = String(
      shopifyOrder.fulfillment_status ?? shopifyOrder.fulfillmentStatus ?? '',
    ).toLowerCase();
    if (fulfillmentStatus !== 'fulfilled') {
      return null;
    }

    const fulfillments = this.arrayPayload(shopifyOrder.fulfillments);
    if (
      fulfillments.some((fulfillment) =>
        this.arrayPayload(
          fulfillment.tracking_numbers ?? fulfillment.trackingNumbers,
        ).some((number) => String(number) === trackingNumber),
      )
    ) {
      return null;
    }

    return this.stringOrNull(fulfillments.at(-1)?.id);
  }

  private sapoTrackingNumber(order: Record<string, any>): string | null {
    const orderFulfillmentStatus = String(
      order.fulfillment_status ?? order.fulfillmentStatus ?? '',
    ).toLowerCase();
    if (orderFulfillmentStatus !== 'shipped') {
      return null;
    }

    return this.firstString(
      ...this.arrayPayload(order.fulfillments).map((fulfillment) => {
        const fulfillmentStatus = String(fulfillment.status ?? '').toLowerCase();
        if (['cancelled', 'canceled'].includes(fulfillmentStatus)) {
          return null;
        }
        const shipment = this.objectPayload(fulfillment.shipment);
        const pushingStatus = this.firstString(
          shipment.pushing_status,
          shipment.pushingStatus,
        );
        const code = this.firstString(shipment.tracking_code, shipment.trackingCode);
        return pushingStatus === 'completed' ? code : null;
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
    sapoOrder: Record<string, any>,
  ): string {
    if (orderType === 'CANCELED' || this.isShopifyCancelled(shopifyOrder)) {
      return 'CANCELLED';
    }

    const fulfillmentStatus = String(
      shopifyOrder.fulfillment_status ?? shopifyOrder.fulfillmentStatus ?? '',
    ).toLowerCase();
    if (fulfillmentStatus === 'fulfilled') {
      return 'FULFILLED';
    }

    // The Sapo list can be briefly stale while an order moves between
    // statuses. Never let a requested SHIPPED pass overwrite the current
    // Sapo truth when it still says that stock has not left the warehouse.
    const sapoFulfillmentStatus = String(
      sapoOrder.fulfillment_status ?? sapoOrder.fulfillmentStatus ?? '',
    ).toLowerCase();
    if (sapoFulfillmentStatus === 'unshipped') {
      return String(sapoOrder.packed_status ?? sapoOrder.packedStatus ?? '').toLowerCase() ===
        'packed'
        ? 'PACKED'
        : 'OPEN';
    }

    if (['RECEIVED', 'COMPLETED'].includes(orderType)) {
      return 'CLOSED';
    }

    if (orderType === 'SHIPPED') {
      return 'SHIPPED';
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
