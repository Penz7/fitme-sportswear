import { SapoToPancakeOrderMapper } from './sapo-to-pancake-order.mapper';

describe('SapoToPancakeOrderMapper', () => {
  function createMapper() {
    const prisma = {
      productMapping: {
        findUnique: jest.fn().mockResolvedValue({
          pancakeProductId: 'pancake-product-1',
          pancakeVariantId: 'pancake-variant-1',
          pancakeWarehouseId: 'warehouse-1',
        }),
      },
    };

    return {
      prisma,
      mapper: new SapoToPancakeOrderMapper(prisma as any),
    };
  }

  it('maps a finalized unpacked Sapo order to a confirmed Pancake order payload', async () => {
    const { mapper, prisma } = createMapper();

    await expect(
      mapper.toPancakeOrder(
        {
          id: 'sapo-order-1',
          total: 300000,
          total_discount: 10000,
          note: 'AUTO_SAPO_API',
          source_id: 1290216695,
          status: 'finalized',
          packed_status: 'unpacked',
          shipping_address: {
            address1: 'Ho Chi Minh',
            city: '79',
            district: '784',
            phone_number: '0909000000',
          },
          customer_data: {
            name: 'Nguyen Van A',
            addresses: [{ phone_number: '0909000000' }],
          },
          order_line_items: [
            {
              sku: 'SKU-1',
              quantity: 2,
              price: 150000,
            },
          ],
        },
        { provinceId: 79, districtId: 784, wardId: 27523 },
      ),
    ).resolves.toEqual({
      total_price: 300000,
      total_discount: 10000,
      note: 'AUTO_SAPO_API',
      shop_id: 1290216695,
      status: 1,
      status_name: 'Da xac nhan',
      warehouse_id: 'warehouse-1',
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      shipping_address: {
        address: 'Ho Chi Minh',
        province_id: 79,
        district_id: 784,
        commune_id: 27523,
        phone_number: '0909000000',
      },
      items: [
        {
          product_id: 'pancake-product-1',
          variation_id: 'pancake-variant-1',
          quantity: 2,
          variation_info: {
            barcode: 'SKU-1',
            display_id: 'SKU-1',
            retail_price: 150000,
          },
        },
      ],
    });
    expect(prisma.productMapping.findUnique).toHaveBeenCalledWith({
      where: { sku: 'SKU-1' },
    });
  });

  it.each([
    [{ status: 'draft' }, 0, 'Moi'],
    [{ status: 'finalized', packed_status: 'packed', fulfillment_status: 'unshipped' }, 8, 'Dang dong hang'],
    [{ status: 'finalized', fulfillment_status: 'shipped' }, 2, 'Da gui hang'],
    [{ status: 'cancelled' }, 6, 'Huy don'],
  ])('maps Sapo status snapshot %o to Pancake status %s', async (sapoStatus, code, name) => {
    const { mapper } = createMapper();

    const payload = await mapper.toPancakeOrder({
      ...sapoStatus,
      order_line_items: [],
    });

    expect(payload).not.toBeNull();
    expect(payload!.status).toBe(code);
    expect(payload!.status_name).toBe(name);
  });

  it('keeps a paid but unfulfilled Sapo order in the operational confirmed status', async () => {
    const { mapper } = createMapper();

    const payload = await mapper.toPancakeOrder({
      status: 'finalized',
      packed_status: 'unpacked',
      fulfillment_status: 'unshipped',
      payment_status: 'paid',
      order_line_items: [],
    });

    expect(payload).not.toBeNull();
    expect(payload!.status).toBe(1);
    expect(payload!.status_name).toBe('Da xac nhan');
  });

  it('maps a finalized packed Sapo order without a fulfillment status to the operational packing status', async () => {
    const { mapper } = createMapper();

    const payload = await mapper.toPancakeOrder({
      status: 'finalized',
      packed_status: 'packed',
      payment_status: 'paid',
      order_line_items: [],
    });

    expect(payload).not.toBeNull();
    expect(payload!.status).toBe(8);
    expect(payload!.status_name).toBe('Dang dong hang');
  });

  it('maps a completed paid Sapo order to the Pancake money collected status', async () => {
    const { mapper } = createMapper();

    const payload = await mapper.toPancakeOrder({
      status: 'completed',
      packed_status: 'packed',
      fulfillment_status: 'shipped',
      payment_status: 'paid',
      order_line_items: [],
    });

    expect(payload).not.toBeNull();
    expect(payload!.status).toBe(16);
    expect(payload!.status_name).toBe('Da thu tien');
  });

  it('builds a status-only payload without requiring line item mappings', () => {
    const { mapper, prisma } = createMapper();

    expect(
      mapper.toPancakeStatusPayload({
        status: 'finalized',
        fulfillment_status: 'shipped',
        order_line_items: [{ sku: 'SKU-MISSING', quantity: 1 }],
      }),
    ).toEqual({
      status: 2,
      status_name: 'Da gui hang',
    });
    expect(prisma.productMapping.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when a Sapo line item has no Pancake product mapping', async () => {
    const { mapper, prisma } = createMapper();
    prisma.productMapping.findUnique.mockResolvedValue(null);

    await expect(
      mapper.toPancakeOrder({
        status: 'draft',
        order_line_items: [{ sku: 'SKU-MISSING', quantity: 1 }],
      }),
    ).resolves.toBeNull();
  });
});
