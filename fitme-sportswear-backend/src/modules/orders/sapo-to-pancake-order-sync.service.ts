import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressMappingService } from '../address/address-mapping.service';
import { PrismaService } from '../database/prisma.service';
import { PancakeClient } from '../pancake/pancake.client';
import {
  SapoToPancakeAddressMapping,
  SapoToPancakeOrderMapper,
  SapoOrderSnapshot,
} from './sapo-to-pancake-order.mapper';

export interface SapoToPancakeOrderSyncResult {
  action: 'created' | 'updated' | 'skipped';
  sapoOrderId: string | null;
  pancakeOrderId: string | null;
}

@Injectable()
export class SapoToPancakeOrderSyncService {
  private readonly logger = new Logger(SapoToPancakeOrderSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pancakeClient: PancakeClient,
    private readonly mapper: SapoToPancakeOrderMapper,
    private readonly configService?: ConfigService,
    private readonly addressMappingService?: AddressMappingService,
  ) {}

  async syncSapoOrder(
    sapoOrder: SapoOrderSnapshot,
  ): Promise<SapoToPancakeOrderSyncResult> {
    const sapoOrderId = this.stringOrNull(sapoOrder.id);
    const mapping = sapoOrderId
      ? await this.prisma.orderMapping.findFirst({ where: { sapoOrderId } })
      : null;
    if (sapoOrderId && mapping?.pancakeOrderId) {
      const statusPayload = this.mapper.toPancakeStatusPayload(sapoOrder);
      if (this.shouldSkipPancakeStatusUpdate(mapping, statusPayload)) {
        await this.upsertMapping({
          sapoOrder,
          sapoOrderId,
          pancakeOrderId: mapping.pancakeOrderId,
          pancakeOrder: {},
          payload: {
            status: mapping.pancakeStatus,
            status_name: mapping.pancakeStatusDescription,
          },
        });

        return {
          action: 'skipped',
          sapoOrderId,
          pancakeOrderId: mapping.pancakeOrderId,
        };
      }

      const addressMapping = await this.resolvePancakeAddressMapping(sapoOrder);
      const fullPayload = await this.mapper.toPancakeOrder(
        sapoOrder,
        addressMapping,
      );
      const payload = fullPayload ?? statusPayload;
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

      return {
        action: 'updated',
        sapoOrderId,
        pancakeOrderId,
      };
    }

    const addressMapping = await this.resolvePancakeAddressMapping(sapoOrder);
    const payload = await this.mapper.toPancakeOrder(sapoOrder, addressMapping);

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

  private async resolvePancakeAddressMapping(
    sapoOrder: SapoOrderSnapshot,
  ): Promise<SapoToPancakeAddressMapping> {
    if (!this.addressMappingService?.resolvePancakeAddressFromSapoText) {
      return { provinceId: null, districtId: null, wardId: null };
    }

    const shippingAddress = this.objectPayload(
      sapoOrder.shipping_address ?? sapoOrder.shippingAddress,
    );
    const fullAddress = this.stringOrNull(
      shippingAddress.address1 ?? shippingAddress.address,
    );
    const resolved = await this.addressMappingService.resolvePancakeAddressFromSapoText({
      provinceName: this.stringOrNull(
        shippingAddress.city ?? shippingAddress.province,
      ),
      districtName: this.stringOrNull(shippingAddress.district),
      wardName: this.stringOrNull(shippingAddress.ward),
      fullAddress,
    });

    return {
      provinceId: resolved.provinceId,
      districtId: resolved.districtId,
      wardId: resolved.wardId,
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

    this.logger.warn(
      [
        'Skipping Pancake inventory update from Sapo order quantity.',
        'Order line quantity is not stock availability;',
        'use product inventory sync for authoritative Sapo inventory.',
        `sapoOrderId=${this.stringOrNull(sapoOrder.id) ?? 'unknown'}`,
      ].join(' '),
    );
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

  private shouldSkipPancakeStatusUpdate(
    mapping: { pancakeStatus?: number | null },
    payload: Record<string, any>,
  ): boolean {
    const currentStatus = this.numberOrNull(mapping.pancakeStatus);
    const nextStatus = this.numberOrNull(payload.status);
    if (currentStatus === null || nextStatus === null) {
      return false;
    }

    const currentRank = this.pancakeStatusRank(currentStatus);
    const nextRank = this.pancakeStatusRank(nextStatus);
    if (currentRank === null || nextRank === null) {
      return false;
    }

    if (nextStatus === 6) {
      return false;
    }

    if (currentStatus === 6 && nextStatus !== 6) {
      return true;
    }

    if (
      currentStatus === 16 &&
      nextStatus !== 16 &&
      this.isOperationalPancakeStatus(nextStatus)
    ) {
      return false;
    }

    return nextRank < currentRank;
  }

  private isOperationalPancakeStatus(status: number): boolean {
    return [1, 2, 3, 8, 9].includes(status);
  }

  private pancakeStatusRank(status: number): number | null {
    const ranks: Record<number, number> = {
      0: 0,
      1: 1,
      8: 2,
      9: 2,
      2: 3,
      3: 4,
      16: 4,
      4: 5,
      5: 6,
      6: 99,
      7: 99,
    };

    return ranks[status] ?? null;
  }

}
