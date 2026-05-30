import { OrderInventoryImpactService } from './order-inventory-impact.service';
import { PANCAKE_ORDER_STATUSES } from './order-status.mapper';

describe('OrderInventoryImpactService', () => {
  const service = new OrderInventoryImpactService();

  describe('Pancake statuses', () => {
    it.each([
      [PANCAKE_ORDER_STATUSES.NEW.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.WAITING_FOR_STOCK.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.ORDERED.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.WAITING_FOR_PRINT.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.PRINTED.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.CONFIRMED.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.PACKING.code, 'available_only'],
      [PANCAKE_ORDER_STATUSES.WAITING_FOR_SHIPPING.code, 'remain_only'],
      [PANCAKE_ORDER_STATUSES.SHIPPED.code, 'remain_only'],
      [PANCAKE_ORDER_STATUSES.RECEIVED.code, 'remain_only'],
      [PANCAKE_ORDER_STATUSES.MONEY_COLLECTED.code, 'remain_only'],
      [PANCAKE_ORDER_STATUSES.RETURNING.code, 'remain_only'],
      [PANCAKE_ORDER_STATUSES.PARTIALLY_RETURNED.code, 'remain_only'],
      [PANCAKE_ORDER_STATUSES.RETURNED.code, 'remain_and_available'],
      [PANCAKE_ORDER_STATUSES.CANCEL_ORDER.code, 'remain_and_available'],
      [PANCAKE_ORDER_STATUSES.DELETE_ORDER.code, 'remain_and_available'],
    ] as const)('maps Pancake status %s to %s', (statusCode, quantityEffect) => {
      expect(service.resolvePancakeImpact(statusCode)).toMatchObject({
        platform: 'pancake',
        statusCode,
        quantityEffect,
        affectsAvailable:
          quantityEffect === 'available_only' ||
          quantityEffect === 'remain_and_available',
        affectsOnHand:
          quantityEffect === 'remain_only' ||
          quantityEffect === 'remain_and_available',
      });
    });

    it('returns no quantity impact for unknown Pancake status', () => {
      expect(service.resolvePancakeImpact(999)).toEqual({
        platform: 'pancake',
        statusCode: 999,
        statusDescription: 'UNKNOWN',
        quantityEffect: 'none',
        affectsAvailable: false,
        affectsOnHand: false,
        reason: 'pancake_unknown_status',
      });
    });
  });

  describe('Sapo statuses', () => {
    it.each([
      [{ status: 'draft' }, 'available_only', 'sapo_order_reserved'],
      [{ status: 'finalized', packed_status: 'unpacked' }, 'available_only', 'sapo_order_reserved'],
      [
        {
          status: 'finalized',
          packed_status: 'packed',
          fulfillment_status: 'unshipped',
        },
        'available_only',
        'sapo_order_reserved',
      ],
      [
        { status: 'finalized', fulfillment_status: 'shipped' },
        'remain_only',
        'sapo_order_stock_moved',
      ],
      [{ status: 'completed' }, 'remain_only', 'sapo_order_stock_moved'],
      [{ status: 'cancelled' }, 'remain_and_available', 'sapo_order_cancelled'],
    ] as const)('maps Sapo order %j to %s', (order, quantityEffect, reason) => {
      expect(service.resolveSapoImpact(order)).toMatchObject({
        platform: 'sapo',
        quantityEffect,
        affectsAvailable:
          quantityEffect === 'available_only' ||
          quantityEffect === 'remain_and_available',
        affectsOnHand:
          quantityEffect === 'remain_only' ||
          quantityEffect === 'remain_and_available',
        reason,
      });
    });

    it('returns no quantity impact for unknown Sapo state', () => {
      expect(service.resolveSapoImpact({ status: 'archived' })).toEqual({
        platform: 'sapo',
        status: 'archived',
        packedStatus: null,
        fulfillmentStatus: null,
        quantityEffect: 'none',
        affectsAvailable: false,
        affectsOnHand: false,
        reason: 'sapo_unknown_status',
      });
    });
  });
});
