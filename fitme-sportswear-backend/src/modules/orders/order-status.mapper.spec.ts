import {
  findOrderTypeBySapoStatusValue,
  findPancakeStatusByCode,
  findSapoStatusesByPancakeCode,
  getQuantityEffectForPancakeStatus,
  resolvePancakeWebhookEventType,
} from './order-status.mapper';

describe('order status mapper', () => {
  it('maps Pancake status codes to legacy status labels', () => {
    expect(findPancakeStatusByCode(0)).toMatchObject({
      key: 'NEW',
      code: 0,
      description: 'Moi',
    });
    expect(findPancakeStatusByCode(1)).toMatchObject({
      key: 'CONFIRMED',
      code: 1,
      description: 'Da xac nhan',
    });
    expect(findPancakeStatusByCode(999)).toBeNull();
  });

  it('maps Pancake order status codes to Sapo statuses like the Java OrderType enum', () => {
    expect(findSapoStatusesByPancakeCode(0)).toEqual([
      { key: 'DAT_HANG', field: 'status', value: 'draft' },
    ]);
    expect(findSapoStatusesByPancakeCode(1)).toEqual([
      { key: 'GIAO_DICH', field: 'status', value: 'finalized' },
      { key: 'CHUA_DONG_GOI', field: 'packed_status', value: 'unpacked' },
    ]);
    expect(findSapoStatusesByPancakeCode(8)).toEqual([
      { key: 'GIAO_DICH', field: 'status', value: 'finalized' },
      { key: 'DA_DONG_GOI', field: 'packed_status', value: 'packed' },
      { key: 'CHUA_XUAT_KHO', field: 'fulfillment_status', value: 'unshipped' },
    ]);
    expect(findSapoStatusesByPancakeCode(16)).toEqual([
      { key: 'DA_THANH_TOAN', field: 'payment_status', value: 'paid' },
    ]);
    expect(findSapoStatusesByPancakeCode(999)).toBeNull();
  });

  it('maps Sapo status values back to the corresponding order type', () => {
    expect(findOrderTypeBySapoStatusValue('draft')).toMatchObject({
      key: 'PLACED',
      pancakeCode: 0,
    });
    expect(findOrderTypeBySapoStatusValue('packed')).toMatchObject({
      key: 'PACKED',
      pancakeCode: 8,
    });
    expect(findOrderTypeBySapoStatusValue('finalized')).toBeNull();
  });

  it('classifies quantity effects for order status changes from the old deployment mapping', () => {
    expect(getQuantityEffectForPancakeStatus(1)).toBe('available_only');
    expect(getQuantityEffectForPancakeStatus(2)).toBe('remain_only');
    expect(getQuantityEffectForPancakeStatus(6)).toBe('remain_and_available');
    expect(getQuantityEffectForPancakeStatus(999)).toBe('none');
  });

  it('resolves Pancake webhook event type using the legacy EventTypeResolver rules', () => {
    expect(resolvePancakeWebhookEventType({ type: 'orders', event_type: 'create' })).toBe(
      'order_created',
    );
    expect(resolvePancakeWebhookEventType({ type: 'orders', event_type: 'update' })).toBe(
      'order_updated',
    );
    expect(resolvePancakeWebhookEventType({ stockInbound: {} })).toBe('stock_inbound');
    expect(resolvePancakeWebhookEventType({ inventory: {} })).toBe('inventory_check');
    expect(resolvePancakeWebhookEventType({})).toBe('unknown');
  });
});
