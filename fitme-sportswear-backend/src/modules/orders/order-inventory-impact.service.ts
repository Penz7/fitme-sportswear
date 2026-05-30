import { Injectable } from '@nestjs/common';
import {
  PANCAKE_ORDER_STATUSES,
  QuantityEffect,
  findPancakeStatusByCode,
} from './order-status.mapper';

export interface PancakeInventoryImpact {
  platform: 'pancake';
  statusCode: number;
  statusDescription: string;
  quantityEffect: QuantityEffect;
  affectsAvailable: boolean;
  affectsOnHand: boolean;
  reason: string;
}

export interface SapoInventoryImpact {
  platform: 'sapo';
  status: string | null;
  packedStatus: string | null;
  fulfillmentStatus: string | null;
  quantityEffect: QuantityEffect;
  affectsAvailable: boolean;
  affectsOnHand: boolean;
  reason: string;
}

@Injectable()
export class OrderInventoryImpactService {
  resolvePancakeImpact(statusCode: number): PancakeInventoryImpact {
    const status = findPancakeStatusByCode(statusCode);
    const quantityEffect = this.resolvePancakeQuantityEffect(statusCode);

    return {
      platform: 'pancake',
      statusCode,
      statusDescription: status?.description ?? 'UNKNOWN',
      quantityEffect,
      ...this.effectBooleans(quantityEffect),
      reason:
        quantityEffect === 'none'
          ? 'pancake_unknown_status'
          : `pancake_${status?.key.toLowerCase()}`,
    };
  }

  resolveSapoImpact(order: Record<string, unknown>): SapoInventoryImpact {
    const status = this.stringOrNull(order.status);
    const packedStatus = this.stringOrNull(
      order.packed_status ?? order.packedStatus,
    );
    const fulfillmentStatus = this.stringOrNull(
      order.fulfillment_status ?? order.fulfillmentStatus,
    );
    const { quantityEffect, reason } = this.resolveSapoQuantityEffect({
      status,
      packedStatus,
      fulfillmentStatus,
    });

    return {
      platform: 'sapo',
      status,
      packedStatus,
      fulfillmentStatus,
      quantityEffect,
      ...this.effectBooleans(quantityEffect),
      reason,
    };
  }

  private resolvePancakeQuantityEffect(statusCode: number): QuantityEffect {
    if (
      ([
        PANCAKE_ORDER_STATUSES.NEW.code,
        PANCAKE_ORDER_STATUSES.WAITING_FOR_STOCK.code,
        PANCAKE_ORDER_STATUSES.ORDERED.code,
        PANCAKE_ORDER_STATUSES.WAITING_FOR_PRINT.code,
        PANCAKE_ORDER_STATUSES.PRINTED.code,
        PANCAKE_ORDER_STATUSES.CONFIRMED.code,
        PANCAKE_ORDER_STATUSES.PACKING.code,
      ] as number[]).includes(statusCode)
    ) {
      return 'available_only';
    }

    if (
      ([
        PANCAKE_ORDER_STATUSES.WAITING_FOR_SHIPPING.code,
        PANCAKE_ORDER_STATUSES.SHIPPED.code,
        PANCAKE_ORDER_STATUSES.RECEIVED.code,
        PANCAKE_ORDER_STATUSES.MONEY_COLLECTED.code,
        PANCAKE_ORDER_STATUSES.RETURNING.code,
        PANCAKE_ORDER_STATUSES.PARTIALLY_RETURNED.code,
      ] as number[]).includes(statusCode)
    ) {
      return 'remain_only';
    }

    if (
      ([
        PANCAKE_ORDER_STATUSES.RETURNED.code,
        PANCAKE_ORDER_STATUSES.CANCEL_ORDER.code,
        PANCAKE_ORDER_STATUSES.DELETE_ORDER.code,
      ] as number[]).includes(statusCode)
    ) {
      return 'remain_and_available';
    }

    return 'none';
  }

  private resolveSapoQuantityEffect(input: {
    status: string | null;
    packedStatus: string | null;
    fulfillmentStatus: string | null;
  }): { quantityEffect: QuantityEffect; reason: string } {
    if (input.status === 'cancelled') {
      return {
        quantityEffect: 'remain_and_available',
        reason: 'sapo_order_cancelled',
      };
    }

    if (input.status === 'completed' || input.fulfillmentStatus === 'shipped') {
      return {
        quantityEffect: 'remain_only',
        reason: 'sapo_order_stock_moved',
      };
    }

    if (
      input.status === 'draft' ||
      input.status === 'finalized' ||
      input.packedStatus === 'packed' ||
      input.fulfillmentStatus === 'unshipped'
    ) {
      return {
        quantityEffect: 'available_only',
        reason: 'sapo_order_reserved',
      };
    }

    return { quantityEffect: 'none', reason: 'sapo_unknown_status' };
  }

  private effectBooleans(quantityEffect: QuantityEffect) {
    return {
      affectsAvailable:
        quantityEffect === 'available_only' ||
        quantityEffect === 'remain_and_available',
      affectsOnHand:
        quantityEffect === 'remain_only' ||
        quantityEffect === 'remain_and_available',
    };
  }

  private stringOrNull(value: unknown): string | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    return String(value);
  }
}
