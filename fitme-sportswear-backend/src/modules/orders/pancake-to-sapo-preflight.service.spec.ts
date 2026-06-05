import { PancakeToSapoPreflightService } from './pancake-to-sapo-preflight.service';

describe('PancakeToSapoPreflightService', () => {
  function createService() {
    const prisma = {
      orderMapping: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productMapping: {
        findUnique: jest.fn().mockResolvedValue({
          sapoProductId: 'sapo-product-1',
          sapoVariantId: 'sapo-variant-1',
        }),
      },
      provinceMapping: {
        findFirst: jest.fn().mockResolvedValue({ sapoId: 79 }),
      },
      districtMapping: {
        findFirst: jest.fn().mockResolvedValue({ sapoId: 784 }),
      },
      wardMapping: {
        findFirst: jest.fn().mockResolvedValue({ sapoId: 27523 }),
      },
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          'sapo.pancakeSourceId': 5632931,
          'sapo.locationIdByPancakeWarehouseId': {
            'warehouse-1': '572310',
          },
          'sapo.prepaymentMethodId': 2575663,
          'sapo.prepaymentMethodName': 'Chuyen khoan',
        };
        return values[key];
      }),
    };
    const sapoClient = {
      fetchOrders: jest.fn().mockResolvedValue({ orders: [] }),
    };

    return {
      prisma,
      sapoClient,
      service: new PancakeToSapoPreflightService(
        prisma as any,
        configService as any,
        sapoClient as any,
      ),
    };
  }

  function validOrder() {
    return {
      id: 'pancake-order-1',
      status: 0,
      warehouse_id: 'warehouse-1',
      total_price: 150000,
      prepaid: 50000,
      note: 'call first',
      tags: ['phase-4'],
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      bill_email: 'a@example.com',
      shipping_address: {
        full_name: 'Nguyen Van A',
        phone_number: '0909000000',
        address: '11 Street',
        full_address: '11 Street, Ward, District, City',
        province_id: 1,
        province_name: 'City',
        district_id: 2,
        district_name: 'District',
        commune_id: 3,
        commune_name: 'Ward',
      },
      items: [
        {
          quantity: 1,
          total_discount: 0,
          variation_info: {
            barcode: 'SKU-1',
            name: 'Size M',
            retail_price: 150000,
          },
        },
      ],
    };
  }

  it('builds a verified Sapo order and redacted preview', async () => {
    const { service } = createService();

    const result = await service.preflight(validOrder());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.sapoOrder).toEqual(
      expect.objectContaining({
        code: 'AUTO_PANCAKE_pancake-order-1',
        source_id: 5632931,
        location_id: 572310,
        status: 'draft',
        total: 150000,
        shipping_address: expect.objectContaining({
          full_address: '11 Street, Ward, District, City',
          ward: 'Ward',
        }),
        order_line_items: [
          expect.objectContaining({
            sku: 'SKU-1',
            quantity: 1,
            price: 150000,
            product_id: 'sapo-product-1',
            variant_id: 'sapo-variant-1',
          }),
        ],
      }),
    );
    expect(result.prepayment).toEqual({
      prepayment: expect.objectContaining({
        payment_method_id: 2575663,
        payment_method_name: 'Chuyen khoan',
        amount: 50000,
      }),
    });
    expect(JSON.stringify(result.preview)).not.toContain('Nguyen Van A');
    expect(JSON.stringify(result.preview)).not.toContain('0909000000');
    expect(JSON.stringify(result.preview)).not.toContain('a@example.com');
    expect(JSON.stringify(result.preview)).not.toContain('11 Street');
  });

  it('returns all required-field errors without building a payload', async () => {
    const { service } = createService();

    const result = await service.preflight({
      id: '',
      warehouse_id: 'unknown',
      total_price: null,
      bill_full_name: '',
      bill_phone_number: '',
      shipping_address: {},
      items: [],
    });

    expect(result.valid).toBe(false);
    expect(result.sapoOrder).toBeNull();
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Pancake order id is required',
        'Pancake warehouse unknown is not mapped to a Sapo location',
        'Customer full name is required',
        'Customer phone number is required',
        'Total price is required',
        'Shipping full address is required',
        'Shipping province id is required',
        'Shipping province name is required',
        'Shipping district id is required',
        'Shipping district name is required',
        'Shipping commune id is required',
        'Shipping commune name is required',
        'At least one line item is required',
      ]),
    );
  });

  it('rejects null item numbers and missing Sapo mappings instead of converting them to zero', async () => {
    const { service, prisma } = createService();
    prisma.productMapping.findUnique.mockResolvedValue(null);
    const order = validOrder();
    order.items[0].quantity = null as any;
    order.items[0].variation_info.retail_price = null as any;

    const result = await service.preflight(order);

    expect(result.valid).toBe(false);
    expect(result.sapoOrder).toBeNull();
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Line item 1 quantity must be greater than zero',
        'Line item 1 price is required',
        'SKU SKU-1 is missing a complete Sapo product mapping',
      ]),
    );
  });

  it('rejects an order that is already mapped', async () => {
    const { service, prisma } = createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      pancakeOrderId: 'pancake-order-1',
      sapoOrderId: 'sapo-order-1',
    });

    const result = await service.preflight(validOrder());

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Pancake order pancake-order-1 already has an order mapping',
    );
  });

  it('rejects an order whose AUTO_PANCAKE code already exists in Sapo', async () => {
    const { service, sapoClient } = createService();
    sapoClient.fetchOrders.mockResolvedValue({
      orders: [{ id: 'sapo-order-1', code: 'AUTO_PANCAKE_pancake-order-1' }],
    });

    const result = await service.preflight(validOrder());

    expect(sapoClient.fetchOrders).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      query: 'AUTO_PANCAKE_pancake-order-1',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Sapo order AUTO_PANCAKE_pancake-order-1 already exists',
    );
  });

  it('rejects Pancake statuses that are not eligible for Sapo order creation', async () => {
    const { service } = createService();
    const order = validOrder();
    order.status = 6;

    const result = await service.preflight(order);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Pancake order status 6 is not eligible for Sapo order creation',
    );
  });

  it('rejects missing province, district, and ward mappings', async () => {
    const { service, prisma } = createService();
    prisma.provinceMapping.findFirst.mockResolvedValue(null);
    prisma.districtMapping.findFirst.mockResolvedValue(null);
    prisma.wardMapping.findFirst.mockResolvedValue(null);

    const result = await service.preflight(validOrder());

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Shipping province 1 is not mapped to Sapo',
        'Shipping district 2 is not mapped to Sapo',
        'Shipping commune 3 is not mapped to Sapo',
      ]),
    );
  });
});
