import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { PancakeClient } from '../pancake/pancake.client';
import { SapoToPancakeOrderMapper, SapoOrderSnapshot } from './sapo-to-pancake-order.mapper';

export interface SapoToPancakeOrderSyncResult {
  action: 'created' | 'updated' | 'skipped';
  sapoOrderId: string | null;
  pancakeOrderId: string | null;
}

@Injectable()
export class SapoToPancakeOrderSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pancakeClient: PancakeClient,
    private readonly mapper: SapoToPancakeOrderMapper,
    private readonly configService?: ConfigService,
  ) {}

  async syncSapoOrder(
    sapoOrder: SapoOrderSnapshot,
  ): Promise<SapoToPancakeOrderSyncResult> {
    const sapoOrderId = this.stringOrNull(sapoOrder.id);
    const mapping = sapoOrderId
      ? await this.prisma.orderMapping.findFirst({ where: { sapoOrderId } })
      : null;
    const payload = await this.mapper.toPancakeOrder(sapoOrder);

    if (!payload || !sapoOrderId) {
      return {
        action: 'skipped',
        sapoOrderId,
        pancakeOrderId: null,
      };
    }

    if (mapping?.pancakeOrderId) {
      const response = await this.pancakeClient.updateOrder(
        mapping.pancakeOrderId,
        payload,
      );
      const pancakeOrder = this.objectPayload(response.data);
      const pancakeOrderId =
        this.stringOrNull(pancakeOrder.id) ?? mapping.pancakeOrderId;

      await this.upsertMapping({
        sapoOrder,
        sapoOrderId,
        pancakeOrderId,
        pancakeOrder,
        payload,
      });
      await this.updatePancakeInventoryByOrder(sapoOrder);

      return {
        action: 'updated',
        sapoOrderId,
        pancakeOrderId,
      };
    }

    const response = await this.pancakeClient.createOrder(payload);
    const pancakeOrder = this.objectPayload(response.data);
    const pancakeOrderId = this.stringOrNull(pancakeOrder.id);

    if (!pancakeOrderId) {
      throw new Error(`Missing Pancake order id for Sapo order ${sapoOrderId}`);
    }

    await this.upsertMapping({
      sapoOrder,
      sapoOrderId,
      pancakeOrderId,
      pancakeOrder,
      payload,
    });
    await this.updatePancakeInventoryByOrder(sapoOrder);

    return {
      action: 'created',
      sapoOrderId,
      pancakeOrderId,
    };
  }

  private async upsertMapping(input: {
    sapoOrder: SapoOrderSnapshot;
    sapoOrderId: string;
    pancakeOrderId: string;
    pancakeOrder: Record<string, any>;
    payload: Record<string, any>;
  }): Promise<void> {
    const pancakeStatus =
      this.numberOrNull(input.pancakeOrder.status) ??
      this.numberOrNull(input.payload.status);
    const pancakeStatusDescription =
      this.stringOrNull(input.pancakeOrder.status_name) ??
      this.stringOrNull(input.payload.status_name);
    const data = {
      sapoOrderId: input.sapoOrderId,
      pancakeOrderId: input.pancakeOrderId,
      pancakeStatus,
      pancakeStatusDescription,
      sapoStatus: this.stringOrNull(input.sapoOrder.status),
      sapoPackedStatus: this.stringOrNull(input.sapoOrder.packed_status),
      sapoFulfillmentStatus: this.stringOrNull(input.sapoOrder.fulfillment_status),
      sapoReceivedStatus: this.stringOrNull(input.sapoOrder.received_status),
      sapoPaymentStatus: this.stringOrNull(input.sapoOrder.payment_status),
      sapoReturnStatus: this.stringOrNull(input.sapoOrder.return_status),
    };

    await this.prisma.orderMapping.upsert({
      where: { pancakeOrderId: input.pancakeOrderId },
      create: data,
      update: data,
    });
  }

  private async updatePancakeInventoryByOrder(
    sapoOrder: SapoOrderSnapshot,
  ): Promise<void> {
    if (!this.configBoolean('sync.orders.updatePancakeInventoryByOrder', false)) {
      return;
    }

    for (const lineItem of this.arrayPayload(
      sapoOrder.order_line_items ?? sapoOrder.orderLineItems,
    )) {
      const sku = this.stringOrNull(lineItem.sku);
      const quantity = this.numberOrNull(lineItem.quantity);

      if (!sku || quantity === null) {
        continue;
      }

      const mapping = await this.prisma.productMapping.findUnique({
        where: { sku },
      });

      if (!mapping?.pancakeVariantId) {
        continue;
      }

      await this.pancakeClient.updateInventory({
        variantId: mapping.pancakeVariantId,
        warehouseId: mapping.pancakeWarehouseId,
        available: quantity,
      });
    }
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

  private numberOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stringOrNull(value: unknown): string | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    return String(value);
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService?.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }
}
