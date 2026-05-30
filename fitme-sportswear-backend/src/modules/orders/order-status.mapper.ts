export type QuantityEffect =
  | 'available_only'
  | 'remain_only'
  | 'remain_and_available'
  | 'none';

export interface SapoOrderStatus {
  key: string;
  field: string;
  value: string;
}

export interface PancakeOrderStatus {
  key: string;
  code: number;
  description: string;
}

export interface OrderTypeMapping {
  key: string;
  pancakeCode: number;
  sapoStatuses: SapoOrderStatus[];
}

export const SAPO_ORDER_STATUSES = {
  DAT_HANG: { key: 'DAT_HANG', field: 'status', value: 'draft' },
  GIAO_DICH: { key: 'GIAO_DICH', field: 'status', value: 'finalized' },
  HOAN_THANH: { key: 'HOAN_THANH', field: 'status', value: 'completed' },
  DA_HUY: { key: 'DA_HUY', field: 'status', value: 'cancelled' },
  KET_THUC: { key: 'KET_THUC', field: 'status', value: 'finished' },
  CHUA_DONG_GOI: {
    key: 'CHUA_DONG_GOI',
    field: 'packed_status',
    value: 'unpacked',
  },
  DA_DONG_GOI: { key: 'DA_DONG_GOI', field: 'packed_status', value: 'packed' },
  CHUA_XUAT_KHO: {
    key: 'CHUA_XUAT_KHO',
    field: 'fulfillment_status',
    value: 'unshipped',
  },
  DA_XUAT_KHO: {
    key: 'DA_XUAT_KHO',
    field: 'fulfillment_status',
    value: 'shipped',
  },
  CHUA_NHAN: { key: 'CHUA_NHAN', field: 'received_status', value: 'unreceived' },
  DA_NHAN: { key: 'DA_NHAN', field: 'received_status', value: 'received' },
  CHUA_THANH_TOAN: {
    key: 'CHUA_THANH_TOAN',
    field: 'payment_status',
    value: 'unpaid',
  },
  DA_THANH_TOAN: {
    key: 'DA_THANH_TOAN',
    field: 'payment_status',
    value: 'paid',
  },
  CHUA_TRA_HANG: {
    key: 'CHUA_TRA_HANG',
    field: 'return_status',
    value: 'unreturned',
  },
  TRA_MOT_PHAN: { key: 'TRA_MOT_PHAN', field: 'return_status', value: 'partial' },
  DA_TRA_HANG: { key: 'DA_TRA_HANG', field: 'return_status', value: 'returned' },
} as const satisfies Record<string, SapoOrderStatus>;

export const PANCAKE_ORDER_STATUSES = {
  NEW: { key: 'NEW', code: 0, description: 'Moi' },
  WAITING_FOR_STOCK: { key: 'WAITING_FOR_STOCK', code: 11, description: 'Cho hang' },
  CONFIRMED: { key: 'CONFIRMED', code: 1, description: 'Da xac nhan' },
  PACKING: { key: 'PACKING', code: 8, description: 'Dang dong hang' },
  WAITING_FOR_SHIPPING: {
    key: 'WAITING_FOR_SHIPPING',
    code: 9,
    description: 'Cho chuyen hang',
  },
  SHIPPED: { key: 'SHIPPED', code: 2, description: 'Da gui hang' },
  RECEIVED: { key: 'RECEIVED', code: 3, description: 'Da nhan' },
  MONEY_COLLECTED: { key: 'MONEY_COLLECTED', code: 16, description: 'Da thu tien' },
  RETURNING: { key: 'RETURNING', code: 4, description: 'Dang tra hang' },
  RETURNED: { key: 'RETURNED', code: 5, description: 'Da hoan' },
  CANCEL_ORDER: { key: 'CANCEL_ORDER', code: 6, description: 'Huy don' },
  DELETE_ORDER: { key: 'DELETE_ORDER', code: 7, description: 'Xoa don' },
  ORDERED: { key: 'ORDERED', code: 20, description: 'Da dat hang' },
  WAITING_FOR_PRINT: { key: 'WAITING_FOR_PRINT', code: 12, description: 'Cho in' },
  PRINTED: { key: 'PRINTED', code: 13, description: 'Da in' },
  PARTIALLY_RETURNED: { key: 'PARTIALLY_RETURNED', code: 15, description: 'Hoan 1 phan' },
} as const satisfies Record<string, PancakeOrderStatus>;

export const ORDER_TYPE_MAPPINGS: OrderTypeMapping[] = [
  {
    key: 'PLACED',
    pancakeCode: PANCAKE_ORDER_STATUSES.NEW.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.DAT_HANG],
  },
  {
    key: 'APPROVED',
    pancakeCode: PANCAKE_ORDER_STATUSES.CONFIRMED.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.GIAO_DICH, SAPO_ORDER_STATUSES.CHUA_DONG_GOI],
  },
  {
    key: 'PACKED',
    pancakeCode: PANCAKE_ORDER_STATUSES.PACKING.code,
    sapoStatuses: [
      SAPO_ORDER_STATUSES.GIAO_DICH,
      SAPO_ORDER_STATUSES.DA_DONG_GOI,
      SAPO_ORDER_STATUSES.CHUA_XUAT_KHO,
    ],
  },
  {
    key: 'SHIPPED',
    pancakeCode: PANCAKE_ORDER_STATUSES.SHIPPED.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.GIAO_DICH, SAPO_ORDER_STATUSES.DA_XUAT_KHO],
  },
  {
    key: 'COMPLETED',
    pancakeCode: PANCAKE_ORDER_STATUSES.MONEY_COLLECTED.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.HOAN_THANH],
  },
  {
    key: 'CANCELED',
    pancakeCode: PANCAKE_ORDER_STATUSES.CANCEL_ORDER.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.DA_HUY],
  },
  {
    key: 'RETURNING',
    pancakeCode: PANCAKE_ORDER_STATUSES.RETURNING.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.TRA_MOT_PHAN],
  },
  {
    key: 'RETURNED',
    pancakeCode: PANCAKE_ORDER_STATUSES.RETURNED.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.DA_TRA_HANG],
  },
  {
    key: 'RECEIVED',
    pancakeCode: PANCAKE_ORDER_STATUSES.RECEIVED.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.DA_NHAN, SAPO_ORDER_STATUSES.CHUA_THANH_TOAN],
  },
  {
    key: 'PAID',
    pancakeCode: PANCAKE_ORDER_STATUSES.MONEY_COLLECTED.code,
    sapoStatuses: [SAPO_ORDER_STATUSES.DA_THANH_TOAN],
  },
];

export function findPancakeStatusByCode(code: number): PancakeOrderStatus | null {
  return (
    Object.values(PANCAKE_ORDER_STATUSES).find((status) => status.code === code) ??
    null
  );
}

export function findSapoStatusesByPancakeCode(
  code: number,
): SapoOrderStatus[] | null {
  return (
    ORDER_TYPE_MAPPINGS.find((mapping) => mapping.pancakeCode === code)
      ?.sapoStatuses ?? null
  );
}

export function findOrderTypeBySapoStatusValue(
  value: string,
): OrderTypeMapping | null {
  const status = Object.values(SAPO_ORDER_STATUSES).find(
    (candidate) => candidate.value === value,
  );

  if (!status || status.key === 'GIAO_DICH') {
    return null;
  }

  return (
    ORDER_TYPE_MAPPINGS.find((mapping) =>
      mapping.sapoStatuses.some((candidate) => candidate.key === status.key),
    ) ?? null
  );
}

export function getQuantityEffectForPancakeStatus(code: number): QuantityEffect {
  if ([0, 1, 8, 11, 12, 13, 20].includes(code)) {
    return 'available_only';
  }

  if ([2, 3, 4, 9, 15, 16].includes(code)) {
    return 'remain_only';
  }

  if ([5, 6, 7].includes(code)) {
    return 'remain_and_available';
  }

  return 'none';
}

export function resolvePancakeWebhookEventType(payload: Record<string, unknown>): string {
  if (payload.type === 'orders' && payload.event_type === 'create') {
    return 'order_created';
  }

  if (payload.type === 'orders' && payload.event_type === 'update') {
    return 'order_updated';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'stockInbound')) {
    return 'stock_inbound';
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'inventory')) {
    return 'inventory_check';
  }

  return 'unknown';
}
