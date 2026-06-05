import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PANCAKE_ORDER_STATUSES } from './order-status.mapper';

export type SapoOrderSnapshot = Record<string, any>;
export type PancakeOrderPayload = Record<string, any>;

export interface SapoToPancakeAddressMapping {
  provinceId: number | null;
  districtId: number | null;
  wardId: number | null;
}

@Injectable()
export class SapoToPancakeOrderMapper {
  constructor(private readonly prisma: PrismaService) {}

  async toPancakeOrder(
    sapoOrder: SapoOrderSnapshot,
    addressMapping: SapoToPancakeAddressMapping = {
      provinceId: null,
      districtId: null,
      wardId: null,
    },
  ): Promise<PancakeOrderPayload | null> {
    const items = await this.toPancakeItems(
      this.arrayPayload(sapoOrder.order_line_items ?? sapoOrder.orderLineItems),
    );

    if (items === null) {
      return null;
    }

    const status = this.resolveStatus(sapoOrder);
    const shippingAddress = this.objectPayload(
      sapoOrder.shipping_address ?? sapoOrder.shippingAddress,
    );
    const customerData = this.objectPayload(
      sapoOrder.customer_data ?? sapoOrder.customerData,
    );
    const customerAddress = this.arrayPayload(customerData.addresses)[0] ?? {};

    return {
      total_price: this.numberValue(sapoOrder.total),
      total_discount: this.numberValue(
        sapoOrder.total_discount ?? sapoOrder.totalDiscount,
      ),
      note: sapoOrder.note ?? null,
      shop_id: this.numberValue(sapoOrder.source_id ?? sapoOrder.sourceId),
      status: status.code,
      status_name: status.description,
      warehouse_id: items[0]?.warehouse_id ?? null,
      bill_full_name: customerData.name ?? null,
      bill_phone_number:
        customerAddress.phone_number ??
        customerAddress.phoneNumber ??
        shippingAddress.phone_number ??
        shippingAddress.phoneNumber ??
        null,
      shipping_address: {
        address: shippingAddress.address1 ?? shippingAddress.address ?? null,
        province_id: addressMapping.provinceId,
        district_id: addressMapping.districtId,
        commune_id: addressMapping.wardId,
        phone_number:
          shippingAddress.phone_number ?? shippingAddress.phoneNumber ?? null,
      },
      items: items.map(({ warehouse_id: _warehouseId, ...item }) => item),
    };
  }

  private async toPancakeItems(
    sapoLineItems: Record<string, any>[],
  ): Promise<Array<Record<string, any> & { warehouse_id: string | null }> | null> {
    const items = [];

    for (const lineItem of sapoLineItems) {
      const sku = this.stringOrNull(lineItem.sku);
      const mapping = sku
        ? await this.prisma.productMapping.findUnique({ where: { sku } })
        : null;

      if (!mapping?.pancakeProductId || !mapping?.pancakeVariantId) {
        return null;
      }

      items.push({
        product_id: mapping.pancakeProductId,
        variation_id: mapping.pancakeVariantId,
        warehouse_id: mapping.pancakeWarehouseId ?? null,
        quantity: this.numberValue(lineItem.quantity),
        variation_info: {
          barcode: sku,
          display_id: sku,
          retail_price: this.numberValue(lineItem.price),
        },
      });
    }

    return items;
  }

  private resolveStatus(sapoOrder: SapoOrderSnapshot) {
    if (sapoOrder.status === 'draft') {
      return PANCAKE_ORDER_STATUSES.NEW;
    }

    if (sapoOrder.status === 'cancelled') {
      return PANCAKE_ORDER_STATUSES.CANCEL_ORDER;
    }

    if (sapoOrder.status === 'completed' || sapoOrder.payment_status === 'paid') {
      return PANCAKE_ORDER_STATUSES.MONEY_COLLECTED;
    }

    if (sapoOrder.fulfillment_status === 'shipped') {
      return PANCAKE_ORDER_STATUSES.SHIPPED;
    }

    if (
      sapoOrder.status === 'finalized' &&
      sapoOrder.packed_status === 'packed' &&
      sapoOrder.fulfillment_status === 'unshipped'
    ) {
      return PANCAKE_ORDER_STATUSES.PACKING;
    }

    if (sapoOrder.status === 'finalized') {
      return PANCAKE_ORDER_STATUSES.CONFIRMED;
    }

    return PANCAKE_ORDER_STATUSES.NEW;
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

  private numberValue(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private stringOrNull(value: unknown): string | null {
    const normalized = value === null || value === undefined ? '' : String(value).trim();
    if (normalized === '') {
      return null;
    }

    return normalized;
  }
}
