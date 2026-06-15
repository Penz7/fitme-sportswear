import { OrderWebhookExecutionService } from './order-webhook-execution.service';
import { OrderWebhookProcessingPlan } from './order-webhook-processing.service';

describe('OrderWebhookExecutionService', () => {
  const basePlan: OrderWebhookProcessingPlan = {
    platform: 'pancake',
    eventType: 'order_created',
    externalOrderId: 'pancake-order-1',
    statusCode: 0,
    statusDescription: 'Moi',
    quantityEffect: 'remain_only',
    sapoStatuses: [],
    nextActions: ['create_sapo_order', 'finalize_sapo_order', 'upsert_order_mapping'],
  };

  function createService() {
    const prisma = {
      orderMapping: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
      productMapping: {
        findUnique: jest.fn().mockResolvedValue({
          sapoProductId: 'sapo-product-1',
          sapoVariantId: 'sapo-variant-1',
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      sapoProduct: {
        findUnique: jest.fn(),
      },
    };
    const sapoClient = {
      createOrder: jest.fn().mockResolvedValue({ order: { id: 'sapo-order-1' } }),
      findOrderByCode: jest.fn().mockResolvedValue(null),
      fetchCustomers: jest.fn().mockResolvedValue({ customers: [] }),
      createCustomer: jest.fn().mockResolvedValue({ customer: { id: 12345 } }),
      finalizeOrder: jest.fn().mockResolvedValue({}),
      prepayOrder: jest.fn().mockResolvedValue({}),
      fetchOrder: jest.fn().mockResolvedValue({
        order: {
          id: 'sapo-order-1',
          order_line_items: [{ id: 'sapo-line-1', sku: 'SKU-1', product_name: 'Shirt', price: 150000 }],
          shipping_address: {
            full_name: 'Nguyen Van A',
            phone_number: '0909000000',
            full_address: 'Ho Chi Minh',
            address1: 'Ho Chi Minh',
          },
          fulfillments: [{ id: 'fulfillment-1', shipment: { tracking_code: 'VTP123' } }],
          status: 'finalized',
          packed_status: 'packed',
          fulfillment_status: 'shipped',
          received_status: 'unreceived',
          payment_status: 'paid',
          return_status: 'unreturned',
        },
      }),
      updateOrder: jest.fn().mockResolvedValue({}),
      createFulfillment: jest.fn().mockResolvedValue({}),
      shipFulfillment: jest.fn().mockResolvedValue({}),
      cancelFulfillment: jest.fn().mockResolvedValue({}),
      receiveAfterCancellation: jest.fn().mockResolvedValue({}),
      cancelOrder: jest.fn().mockResolvedValue({}),
      getFreightAmount: jest.fn().mockResolvedValue(42000),
    };
    const shopifyClient = {
      createFulfillment: jest.fn().mockResolvedValue({}),
    };
    const addressMappingService = {
      resolvePancakeAddress: jest.fn().mockResolvedValue({
        provinceId: 79,
        districtId: 784,
        wardId: 27523,
        wardName: 'Xa mapped',
        cityName: 'TP Ho Chi Minh',
        districtName: 'Hoc Mon',
      }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number | Record<string, string> | undefined> = {
          'sapo.locationId': '572310',
          'sapo.locationIdByPancakeWarehouseId': {
            'pancake-warehouse-1': '999999',
          },
          'sapo.prepaymentMethodId': 2575663,
          'sapo.prepaymentMethodName': 'Chuyen khoan',
          'shipping.viettelPost.service': 'VSL7',
          'shipping.viettelPost.accountId': '604003_1',
          'shipping.viettelPost.providerId': 508146,
          'shipping.viettelPost.inventoryId': 22207987,
          'shipping.viettelPost.trackingCompany': 'Viettel',
          'shipping.sender.provinceId': 2,
          'shipping.sender.districtId': 55,
          'shipping.package.weight': 300,
          'shipping.package.height': 10,
          'shipping.package.width': 10,
          'shipping.package.length': 10,
        };
        return values[key];
      }),
    };
    const notifier = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    return {
      prisma,
      sapoClient,
      shopifyClient,
      addressMappingService,
      configService,
      notifier,
      service: new OrderWebhookExecutionService(
        prisma as any,
        sapoClient as any,
        shopifyClient as any,
        addressMappingService as any,
        configService as any,
        notifier as any,
      ),
    };
  }

  it('creates a Sapo order from a Pancake order webhook and stores the mapping', async () => {
    const { service, sapoClient, prisma, addressMappingService } = createService();

    await service.executePlan(basePlan, {
      id: 'pancake-order-1',
      total_price: 300000,
      note: 'call first',
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      prepaid: 100000,
      warehouse_info: {
        id: 'pancake-warehouse-1',
      },
      shipping_address: {
        full_name: 'Nguyen Van A',
        phone_number: '0909000000',
        full_address: 'Ho Chi Minh',
        province_name: 'Ho Chi Minh',
        district_name: 'Hoc Mon',
      },
      items: [
        {
          quantity: 2,
          total_discount: 10000,
          variation_info: {
            barcode: 'SKU-1',
            name: 'Size M',
            retail_price: 150000,
          },
        },
      ],
    });

    expect(sapoClient.createOrder).toHaveBeenCalledWith(
      {
        order: expect.objectContaining({
          code: 'AUTO_PANCAKE_pancake-order-1',
          customer_id: 12345,
          total: 300000,
          status: 'draft',
          phone_number: '0909000000',
          location_id: 999999,
          order_line_items: [
            expect.objectContaining({
              sku: 'SKU-1',
              quantity: 2,
              product_id: 'sapo-product-1',
              variant_id: 'sapo-variant-1',
            }),
          ],
        }),
      },
      { locationId: '999999' },
    );
    expect(sapoClient.fetchCustomers).toHaveBeenCalledWith(1, 1, '0909000000');
    expect(sapoClient.createCustomer).toHaveBeenCalledWith({
      customer: expect.objectContaining({
        phone_number: '0909000000',
        name: 'Nguyen Van A',
      }),
    });
    expect(sapoClient.prepayOrder).toHaveBeenCalledWith(
      'sapo-order-1',
      {
        prepayment: expect.objectContaining({
          payment_method_id: 2575663,
          payment_method_name: 'Chuyen khoan',
          amount: 100000,
          paid_amount: 100000,
          returned_amount: 0,
        }),
      },
      { locationId: '999999' },
    );
    expect(sapoClient.finalizeOrder).toHaveBeenCalledWith('sapo-order-1', {
      locationId: '999999',
      tolerateIdempotent422: true,
    });
    expect(sapoClient.fetchOrder).toHaveBeenCalledWith('sapo-order-1');
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 0,
        sapoStatus: 'finalized',
        sapoPaymentStatus: 'paid',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 0,
        sapoStatus: 'finalized',
        sapoPaymentStatus: 'paid',
      }),
    });
  });

  it('normalizes SKU before resolving product mapping for Sapo line items', async () => {
    const { service, sapoClient, prisma } = createService();

    await service.executePlan(basePlan, {
      id: 'pancake-order-1',
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      items: [{ quantity: 1, variation_info: { barcode: ' SKU-1 ' } }],
    });

    expect(prisma.productMapping.findUnique).toHaveBeenCalledWith({
      where: { sku: 'SKU-1' },
    });
    expect(sapoClient.createOrder).toHaveBeenCalledWith(
      {
        order: expect.objectContaining({
          order_line_items: [
            expect.objectContaining({
              barcode: 'SKU-1',
              sku: 'SKU-1',
              product_id: 'sapo-product-1',
              variant_id: 'sapo-variant-1',
            }),
          ],
        }),
      },
      { locationId: '572310' },
    );
  });

  it('rejects Sapo order creation when a line item SKU has no Sapo product mapping', async () => {
    const { service, sapoClient, prisma } = createService();
    prisma.productMapping.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.executePlan(basePlan, {
        id: 'pancake-order-1',
        bill_full_name: 'Nguyen Van A',
        bill_phone_number: '0909000000',
        items: [{ quantity: 1, variation_info: { barcode: 'UNKNOWN-SKU' } }],
      }),
    ).rejects.toThrow('Missing Sapo product mapping for SKU UNKNOWN-SKU');

    expect(sapoClient.createOrder).not.toHaveBeenCalled();
    expect(sapoClient.finalizeOrder).not.toHaveBeenCalled();
    expect(prisma.orderMapping.upsert).not.toHaveBeenCalled();
  });

  it('creates a Sapo order from shipping address when customer lookup is forbidden', async () => {
    const { service, sapoClient } = createService();
    sapoClient.fetchCustomers.mockRejectedValueOnce(
      new Error('Sapo customers fetch failed with status 403'),
    );
    sapoClient.fetchOrder.mockResolvedValueOnce({
      order: {
        id: 'sapo-order-1',
        shipping_address: {
          full_name: 'Kha Nhi',
          phone_number: '0935596310',
          full_address: '92 Ngo Van So',
          address1: '92 Ngo Van So',
        },
        customer_data: {
          code: 'CUST-1',
          name: 'Kha Nhi',
          phone_number: '0935596310',
        },
      },
    });

    await service.executePlan(basePlan, {
      id: 'pancake-order-1',
      bill_full_name: 'Kha Nhi',
      bill_phone_number: '0935596310',
      shipping_address: {
        full_name: 'Kha Nhi',
        phone_number: '0935596310',
        full_address: '92 Ngo Van So',
      },
      items: [{ quantity: 1, variation_info: { barcode: 'SKU-1' } }],
    });

    expect(sapoClient.createCustomer).not.toHaveBeenCalled();
    expect(sapoClient.createOrder).toHaveBeenCalledWith(
      {
        order: expect.objectContaining({
          shipping_address: expect.objectContaining({
            full_name: 'Kha Nhi',
            phone_number: '0935596310',
          }),
        }),
      },
      { locationId: '572310' },
    );
  });

  it('creates a missing product mapping from Sapo product snapshot before creating an order', async () => {
    const { service, sapoClient, prisma } = createService();
    prisma.productMapping.findUnique.mockResolvedValueOnce(null);
    prisma.sapoProduct.findUnique.mockResolvedValueOnce({
      sku: 'SKU-ONLY-SAPO',
      productId: 'sapo-product-from-snapshot',
      variantId: 'sapo-variant-from-snapshot',
    });
    prisma.productMapping.upsert.mockResolvedValueOnce({
      sku: 'SKU-ONLY-SAPO',
      sapoProductId: 'sapo-product-from-snapshot',
      sapoVariantId: 'sapo-variant-from-snapshot',
      status: 'partial',
    });

    await service.executePlan(basePlan, {
      id: 'pancake-order-1',
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      items: [
        {
          quantity: 1,
          variation_info: {
            barcode: 'SKU-ONLY-SAPO',
            name: 'Size L',
            retail_price: 150000,
          },
        },
      ],
    });

    expect(prisma.sapoProduct.findUnique).toHaveBeenCalledWith({
      where: { sku: 'SKU-ONLY-SAPO' },
    });
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-ONLY-SAPO' },
      create: expect.objectContaining({
        sku: 'SKU-ONLY-SAPO',
        sapoProductId: 'sapo-product-from-snapshot',
        sapoVariantId: 'sapo-variant-from-snapshot',
        status: 'partial',
      }),
      update: expect.objectContaining({
        sapoProductId: 'sapo-product-from-snapshot',
        sapoVariantId: 'sapo-variant-from-snapshot',
        status: 'partial',
      }),
    });
    expect(sapoClient.createOrder).toHaveBeenCalledWith(
      {
        order: expect.objectContaining({
          order_line_items: [
            expect.objectContaining({
              sku: 'SKU-ONLY-SAPO',
              product_id: 'sapo-product-from-snapshot',
              variant_id: 'sapo-variant-from-snapshot',
            }),
          ],
        }),
      },
      { locationId: '572310' },
    );
  });

  it('reuses an existing Sapo order with the same code before creating a duplicate', async () => {
    const { service, sapoClient, prisma } = createService();
    sapoClient.findOrderByCode.mockResolvedValueOnce({ id: 'existing-sapo-order-1' });

    await service.executePlan(basePlan, {
      id: 'pancake-order-1',
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      items: [{ quantity: 1, variation_info: { barcode: 'SKU-1' } }],
    });

    expect(sapoClient.findOrderByCode).toHaveBeenCalledWith(
      'AUTO_PANCAKE_pancake-order-1',
    );
    expect(sapoClient.createOrder).not.toHaveBeenCalled();
    expect(sapoClient.finalizeOrder).toHaveBeenCalledWith('existing-sapo-order-1', {
      locationId: '572310',
      tolerateIdempotent422: true,
    });
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({ sapoOrderId: 'existing-sapo-order-1' }),
      update: expect.objectContaining({ sapoOrderId: 'existing-sapo-order-1' }),
    });
  });

  it('blocks Pancake order mapping when Sapo receiver differs after finalize', async () => {
    const { service, sapoClient, prisma, notifier } = createService();
    sapoClient.fetchOrder.mockResolvedValueOnce({
      order: {
        id: 'sapo-order-1',
        shipping_address: {
          full_name: 'Ngoc Han',
          phone_number: '0938637124',
          full_address: 'CSC Pickleball so 4 duong 65',
        },
      },
    });

    await expect(
      service.executePlan(basePlan, {
        id: 'pancake-order-1',
        bill_full_name: 'Kha Nhi',
        bill_phone_number: '0935596310',
        shipping_address: {
          full_name: 'Kha Nhi',
          phone_number: '0935596310',
          full_address: '92 Ngo Van So',
        },
        items: [{ quantity: 1, variation_info: { barcode: 'SKU-1' } }],
      }),
    ).rejects.toThrow(
      'Sapo shipping address mismatch for Pancake order pancake-order-1',
    );

    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Blocked Pancake -> Sapo order sync because receiver differs',
      expect.stringContaining('actualName=Ngoc Han'),
    );
    expect(prisma.orderMapping.upsert).not.toHaveBeenCalled();
  });

  it('continues when Sapo attaches anonymous customer but order shipping address is still correct', async () => {
    const { service, sapoClient, prisma } = createService();
    sapoClient.fetchOrder.mockResolvedValueOnce({
      order: {
        id: 'sapo-order-1',
        shipping_address: {
          full_name: 'Kha Nhi',
          phone_number: '0935596310',
          full_address: '92 Ngo Van So',
        },
        customer_data: {
          code: 'ANONYMOUS',
          name: 'Khach le',
          addresses: [
            {
              full_name: 'Ngoc Han',
              phone_number: '0938637124',
            },
          ],
        },
      },
    });

    await expect(
      service.executePlan(basePlan, {
        id: 'pancake-order-1',
        bill_full_name: 'Kha Nhi',
        bill_phone_number: '0935596310',
        shipping_address: {
          full_name: 'Kha Nhi',
          phone_number: '0935596310',
          full_address: '92 Ngo Van So',
        },
        items: [{ quantity: 1, variation_info: { barcode: 'SKU-1' } }],
      }),
    ).resolves.toBeUndefined();

    expect(prisma.orderMapping.upsert).toHaveBeenCalled();
  });

  it('blocks Pancake order mapping when Sapo shipment receiver differs after finalize', async () => {
    const { service, sapoClient, prisma, notifier } = createService();
    sapoClient.fetchOrder.mockResolvedValueOnce({
      order: {
        id: 'sapo-order-1',
        shipping_address: {
          full_name: 'Kha Nhi',
          phone_number: '0935596310',
          full_address: '92 Ngo Van So',
        },
        customer_data: {
          code: 'ANONYMOUS',
          name: 'Khach le',
        },
        fulfillments: [
          {
            shipment: {
              shipping_address: {
                full_name: 'Ngoc Han',
                phone_number: '0938637124',
                full_address: 'CSC Pickleball so 4 duong 65',
              },
            },
          },
        ],
      },
    });

    await expect(
      service.executePlan(basePlan, {
        id: 'pancake-order-1',
        bill_full_name: 'Kha Nhi',
        bill_phone_number: '0935596310',
        shipping_address: {
          full_name: 'Kha Nhi',
          phone_number: '0935596310',
          full_address: '92 Ngo Van So',
        },
        items: [{ quantity: 1, variation_info: { barcode: 'SKU-1' } }],
      }),
    ).rejects.toThrow(
      'Sapo shipping address mismatch for Pancake order pancake-order-1',
    );

    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Blocked Pancake -> Sapo order sync because receiver differs',
      expect.stringContaining('shipment_full_name'),
    );
    expect(prisma.orderMapping.upsert).not.toHaveBeenCalled();
  });

  it('falls back to default Sapo location when Pancake warehouse is unmapped', async () => {
    const { service, sapoClient, prisma } = createService();

    await service.executePlan(basePlan, {
      id: 'pancake-order-1',
      bill_full_name: 'Nguyen Van A',
      bill_phone_number: '0909000000',
      warehouse_info: {
        id: 'unknown-warehouse',
      },
      shipping_address: {
        full_name: 'Nguyen Van A',
        phone_number: '0909000000',
      },
      items: [{ quantity: 1, variation_info: { barcode: 'SKU-1' } }],
    });

    expect(sapoClient.createOrder).toHaveBeenCalledWith(
      {
        order: expect.objectContaining({ location_id: 572310 }),
      },
      { locationId: '572310' },
    );
    expect(sapoClient.finalizeOrder).toHaveBeenCalledWith('sapo-order-1', {
      locationId: '572310',
      tolerateIdempotent422: true,
    });
    expect(prisma.orderMapping.upsert).toHaveBeenCalled();
  });

  it('updates, fulfills, ships, and snapshots a mapped Pancake order', async () => {
    const { service, sapoClient, prisma, addressMappingService } = createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    await service.executePlan(
      {
        ...basePlan,
        eventType: 'order_updated',
        statusCode: 2,
        nextActions: [
          'update_sapo_order',
          'create_sapo_fulfillment',
          'deliver_sapo_order',
          'upsert_order_mapping',
        ],
      },
      {
        id: 'pancake-order-1',
        total_price: 300000,
        bill_full_name: 'Nguyen Van A',
        bill_phone_number: '0909000000',
        money_to_collect: 300000,
        is_free_shipping: false,
        shipping_address: {
          full_name: 'Nguyen Van A',
          phone_number: '0909000000',
          full_address: 'Ho Chi Minh',
          province_id: 1,
          district_id: 688,
          commune_id: 12345,
          commune_name: 'Xa Xuan Thoi Thuong',
        },
        warehouse_info: {
          full_address: '11/4B Pham Van Sang',
          province_id: 2,
          district_id: 55,
          commune_id: 947,
        },
        items: [{ quantity: 1, variation_info: { barcode: 'SKU-1', name: 'Size M', retail_price: 150000 } }],
      },
    );

    expect(sapoClient.fetchOrder).toHaveBeenCalledWith('sapo-order-1');
    expect(sapoClient.updateOrder).toHaveBeenCalledWith(
      'sapo-order-1',
      expect.objectContaining({ order: expect.any(Object) }),
      { locationId: '572310' },
    );
    expect(sapoClient.createFulfillment).toHaveBeenCalledWith(
      'sapo-order-1',
      {
        fulfillment: expect.objectContaining({
          shipment: expect.objectContaining({
            freight_amount: 42000,
            detail: expect.any(String),
          }),
        }),
      },
      { locationId: '572310', tolerateIdempotent422: true },
    );
    const fulfillmentPayload = sapoClient.createFulfillment.mock.calls[0][1];
    expect(JSON.parse(fulfillmentPayload.fulfillment.shipment.detail)).toEqual(
      expect.objectContaining({
        receiver_province_id: 79,
        receiver_district_id: 784,
        receiver_ward: 'Xa mapped',
        sender_province_id: 79,
        sender_district_id: 784,
        sender_ward_id: 27523,
        order_service: 'VSL7',
        shipping_account_id: '604003_1',
        product_type: 'HH',
        product_weight: 300,
        cod_amount: 300000,
      }),
    );
    expect(sapoClient.getFreightAmount).toHaveBeenCalledWith({
      senderProvinceId: 79,
      senderDistrictId: 784,
      receiverProvinceId: 79,
      receiverDistrictId: 784,
      codAmount: 300000,
      freightPayer: 'customer',
    });
    expect(addressMappingService.resolvePancakeAddress).toHaveBeenCalledWith({
      provinceId: 1,
      districtId: 688,
      wardId: 12345,
      fallbackProvinceId: 1,
      fallbackDistrictId: 688,
      fallbackWardId: 12345,
      fallbackProvinceName: null,
      fallbackDistrictName: null,
      fallbackWardName: 'Xa Xuan Thoi Thuong',
      fallbackFullAddress: 'Ho Chi Minh',
    });
    expect(addressMappingService.resolvePancakeAddress).toHaveBeenCalledWith({
      provinceId: 2,
      districtId: 55,
      wardId: 947,
      fallbackProvinceId: 2,
      fallbackDistrictId: 55,
      fallbackWardId: 947,
      fallbackFullAddress: '11/4B Pham Van Sang',
      fallbackWardName: null,
    });
    expect(sapoClient.shipFulfillment).toHaveBeenCalledWith(
      'sapo-order-1',
      'fulfillment-1',
      { locationId: '572310', tolerateIdempotent422: true },
    );
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoStatus: 'finalized',
        sapoFulfillmentStatus: 'shipped',
      }),
      update: expect.objectContaining({
        sapoStatus: 'finalized',
        sapoFulfillmentStatus: 'shipped',
      }),
    });
  });

  it('bypasses Pancake fulfillment and notifies when receiver district mapping is missing', async () => {
    const { service, sapoClient, prisma, addressMappingService, notifier } =
      createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    addressMappingService.resolvePancakeAddress
      .mockResolvedValueOnce({
        provinceId: 48,
        districtId: null,
        wardId: null,
        wardName: null,
        cityName: 'Quang Ngai',
        districtName: null,
      })
      .mockResolvedValueOnce({
        provinceId: 79,
        districtId: 784,
        wardId: 27523,
        wardName: 'Xa mapped',
        cityName: 'TP Ho Chi Minh',
        districtName: 'Hoc Mon',
      });

    await expect(
      service.executePlan(
        {
          ...basePlan,
          eventType: 'order_updated',
          statusCode: 1,
          nextActions: ['create_sapo_fulfillment', 'upsert_order_mapping'],
        },
        {
          id: 'pancake-order-1',
          bill_full_name: 'Nguyen Van A',
          bill_phone_number: '0909000000',
          money_to_collect: 300000,
          is_free_shipping: false,
          shipping_address: {
            full_name: 'Nguyen Van A',
            phone_number: '0909000000',
            full_address: 'Ho Chi Minh',
            province_id: 707,
            district_id: 70708,
            commune_id: 7070802,
            commune_name: 'Xa Thanh Tam',
          },
          warehouse_info: {
            province_id: 701,
            district_id: 70137,
            commune_id: 7013717,
          },
          items: [
            {
              quantity: 1,
              variation_info: {
                barcode: 'SKU-1',
                name: 'Size M',
                retail_price: 150000,
              },
            },
          ],
        },
      ),
    ).resolves.toBeUndefined();

    expect(sapoClient.getFreightAmount).not.toHaveBeenCalled();
    expect(sapoClient.createFulfillment).not.toHaveBeenCalled();
    expect(prisma.orderMapping.upsert).toHaveBeenCalled();
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Bypassed Sapo fulfillment because address mapping is incomplete',
      expect.stringContaining('pancakeOrderId=pancake-order-1'),
    );
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Bypassed Sapo fulfillment because address mapping is incomplete',
      expect.stringContaining('missing=receiver district'),
    );
  });

  it('continues Pancake fulfillment with zero freight amount when Sapo freight API rejects the estimate', async () => {
    const { service, sapoClient, prisma } = createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    sapoClient.getFreightAmount.mockRejectedValueOnce(
      new Error('Sapo freight amount fetch failed with status 422'),
    );

    await service.executePlan(
      {
        ...basePlan,
        eventType: 'order_updated',
        statusCode: 1,
        nextActions: ['create_sapo_fulfillment', 'upsert_order_mapping'],
      },
      {
        id: 'pancake-order-1',
        bill_full_name: 'Nguyen Van A',
        bill_phone_number: '0909000000',
        money_to_collect: 300000,
        is_free_shipping: false,
        shipping_address: {
          full_name: 'Nguyen Van A',
          phone_number: '0909000000',
          full_address: 'Ho Chi Minh',
          province_id: 707,
          district_id: 70708,
          commune_id: 7070802,
          commune_name: 'Xa Thanh Tam',
        },
        warehouse_info: {
          province_id: 701,
          district_id: 70137,
          commune_id: 7013717,
        },
        items: [
          {
            quantity: 1,
            variation_info: {
              barcode: 'SKU-1',
              name: 'Size M',
              retail_price: 150000,
            },
          },
        ],
      },
    );

    expect(sapoClient.createFulfillment).toHaveBeenCalledWith(
      'sapo-order-1',
      {
        fulfillment: expect.objectContaining({
          shipment: expect.objectContaining({
            freight_amount: 0,
          }),
        }),
      },
      { locationId: '572310', tolerateIdempotent422: true },
    );
  });

  it('skips Sapo fulfillment without failing the webhook when token lacks fulfillment permission', async () => {
    const { service, sapoClient, prisma } = createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    sapoClient.createFulfillment.mockRejectedValueOnce(
      new Error(
        'Sapo fulfillment create failed with status 403: {"permission":"add_fulfillment_order"}',
      ),
    );

    await expect(
      service.executePlan(
        {
          ...basePlan,
          eventType: 'order_updated',
          statusCode: 1,
          nextActions: ['create_sapo_fulfillment', 'upsert_order_mapping'],
        },
        {
          id: 'pancake-order-1',
          bill_full_name: 'Nguyen Van A',
          bill_phone_number: '0909000000',
          money_to_collect: 300000,
          is_free_shipping: false,
          shipping_address: {
            full_name: 'Nguyen Van A',
            phone_number: '0909000000',
            full_address: 'Ho Chi Minh',
            province_id: 707,
            district_id: 70708,
            commune_id: 7070802,
            commune_name: 'Xa Thanh Tam',
          },
          warehouse_info: {
            province_id: 701,
            district_id: 70137,
            commune_id: 7013717,
          },
          items: [
            {
              quantity: 1,
              variation_info: {
                barcode: 'SKU-1',
                name: 'Size M',
                retail_price: 150000,
              },
            },
          ],
        },
      ),
    ).resolves.toBeUndefined();

    expect(sapoClient.createFulfillment).toHaveBeenCalled();
    expect(sapoClient.fetchOrder).toHaveBeenCalledTimes(1);
  });

  it('continues Sapo order cancellation when fulfillment cancel permission is missing', async () => {
    const { service, sapoClient, prisma, notifier } = createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    sapoClient.cancelFulfillment.mockRejectedValueOnce(
      new Error(
        'Sapo fulfillment cancel failed with status 403: {"permission":"add_fulfillment_order"}',
      ),
    );
    sapoClient.receiveAfterCancellation.mockRejectedValueOnce(
      new Error(
        'Sapo fulfillment receive after cancellation failed with status 403: {"permission":"add_fulfillment_order"}',
      ),
    );
    sapoClient.fetchOrder
      .mockResolvedValueOnce({
        order: {
          id: 'sapo-order-1',
          fulfillments: [{ id: 'fulfillment-1' }],
          status: 'finalized',
          packed_status: 'packed',
          fulfillment_status: 'unshipped',
        },
      })
      .mockResolvedValueOnce({
        order: {
          id: 'sapo-order-1',
          fulfillments: [{ id: 'fulfillment-1' }],
          status: 'cancelled',
          packed_status: 'packed',
          fulfillment_status: 'unshipped',
        },
      });

    await expect(
      service.executePlan(
        {
          ...basePlan,
          eventType: 'order_updated',
          statusCode: 6,
          nextActions: [
            'cancel_sapo_delivery_if_exists',
            'receive_after_cancellation_if_needed',
            'cancel_sapo_order',
            'upsert_order_mapping',
          ],
        },
        {
          id: 'pancake-order-1',
          status: 6,
          status_name: 'canceled',
        },
      ),
    ).resolves.toBeUndefined();

    expect(sapoClient.cancelFulfillment).toHaveBeenCalledWith(
      'sapo-order-1',
      'fulfillment-1',
      undefined,
      { locationId: '572310', tolerateIdempotent422: true },
    );
    expect(sapoClient.receiveAfterCancellation).toHaveBeenCalledWith(
      'sapo-order-1',
      'fulfillment-1',
      undefined,
      { locationId: '572310', tolerateIdempotent422: true },
    );
    expect(sapoClient.cancelOrder).toHaveBeenCalledWith('sapo-order-1', {
      locationId: '572310',
      tolerateIdempotent422: true,
    });
    expect(notifier.sendMessage).toHaveBeenCalledWith(
      'Bypassed Sapo fulfillment action because Sapo token lacks permission',
      expect.stringContaining('action=cancel'),
    );
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 6,
        sapoStatus: 'cancelled',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 6,
        sapoStatus: 'cancelled',
      }),
    });
  });

  it('creates Shopify fulfillment after Sapo shipment produces a tracking code', async () => {
    const { service, shopifyClient } = createService();

    await service.executePlan(
      {
        ...basePlan,
        platform: 'shopify',
        eventType: 'order',
        externalOrderId: 'shopify-order-1',
        statusCode: null,
        nextActions: ['create_sapo_order', 'create_shopify_fulfillment', 'upsert_order_mapping'],
      },
      {
        id: 'shopify-order-1',
        order_number: 1001,
        total_price: '300000',
        email: 'a@example.com',
        shipping_address: { first_name: 'Nguyen Van A', phone: '0909000000', address1: 'Hoc Mon', city: 'Ho Chi Minh' },
        line_items: [{ id: 'line-item-1', sku: 'SKU-1', name: 'Shirt', quantity: 2, price: '150000' }],
      },
    );

    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith({
      orderId: 'shopify-order-1',
      trackingCompany: 'Viettel',
      trackingNumber: 'VTP123',
      notifyCustomer: true,
      lineItems: [{ id: 'line-item-1', quantity: 2 }],
    });
  });

  it('polls Sapo shipment until tracking code is available before Shopify fulfillment', async () => {
    const { service, sapoClient, shopifyClient, configService, prisma } =
      createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      shopifyOrderId: 'shopify-order-1',
    });
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | number | undefined> = {
        'shipping.viettelPost.trackingCompany': 'Viettel',
        'shopify.fulfillmentTrackingPollAttempts': 3,
        'shopify.fulfillmentTrackingPollDelayMs': 0,
      };
      return values[key];
    });
    sapoClient.fetchOrder
      .mockResolvedValueOnce({
        order: {
          id: 'sapo-order-1',
          fulfillments: [{ id: 'fulfillment-1', shipment: {} }],
        },
      })
      .mockResolvedValueOnce({
        order: {
          id: 'sapo-order-1',
          fulfillments: [
            {
              id: 'fulfillment-1',
              shipment: {
                pushing_status: 'completed',
                tracking_code: 'VTP999',
              },
            },
          ],
        },
      });

    await service.executePlan(
      {
        ...basePlan,
        platform: 'shopify',
        eventType: 'order',
        externalOrderId: 'shopify-order-1',
        statusCode: null,
        nextActions: ['create_shopify_fulfillment'],
      },
      {
        id: 'shopify-order-1',
        line_items: [{ id: 'line-item-1', quantity: 1 }],
      },
    );

    expect(sapoClient.fetchOrder).toHaveBeenCalledTimes(2);
    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({ trackingNumber: 'VTP999' }),
    );
  });

  it('uses configured carrier values when building Sapo and Shopify fulfillment payloads', async () => {
    const { service, sapoClient, shopifyClient, prisma, configService } = createService();
    prisma.orderMapping.findUnique.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | number | undefined> = {
        'sapo.locationId': '999999',
        'shipping.viettelPost.service': 'VTP_CUSTOM',
        'shipping.viettelPost.accountId': 'ACCOUNT_CUSTOM',
        'shipping.viettelPost.providerId': 123456,
        'shipping.viettelPost.inventoryId': 987654,
        'shipping.viettelPost.trackingCompany': 'Viettel Custom',
        'shipping.sender.provinceId': 22,
        'shipping.sender.districtId': 66,
        'shipping.package.weight': 550,
        'shipping.package.height': 20,
        'shipping.package.width': 30,
        'shipping.package.length': 40,
      };
      return values[key];
    });

    await service.executePlan(
      {
        ...basePlan,
        eventType: 'order_updated',
        statusCode: 1,
        nextActions: ['create_sapo_fulfillment', 'upsert_order_mapping'],
      },
      {
        id: 'pancake-order-1',
        total_price: 300000,
        bill_full_name: 'Nguyen Van A',
        bill_phone_number: '0909000000',
        money_to_collect: 300000,
        shipping_address: {
          full_name: 'Nguyen Van A',
          phone_number: '0909000000',
          full_address: 'Ho Chi Minh',
          province_id: 1,
          district_id: 688,
          commune_id: 12345,
        },
        warehouse_info: {},
        items: [{ quantity: 1, variation_info: { barcode: 'SKU-1', name: 'Size M', retail_price: 150000 } }],
      },
    );

    const fulfillmentPayload = sapoClient.createFulfillment.mock.calls[0][1];
    const detail = JSON.parse(fulfillmentPayload.fulfillment.shipment.detail);
    expect(fulfillmentPayload.fulfillment.shipment).toEqual(
      expect.objectContaining({
        shipping_account_id: 'ACCOUNT_CUSTOM',
        delivery_service_provider_id: 123456,
        height: 20,
        length: 40,
        width: 30,
        weight: 550,
      }),
    );
    expect(detail).toEqual(
      expect.objectContaining({
        sender_province_id: 79,
        sender_district_id: 784,
        order_service: 'VTP_CUSTOM',
        product_weight: 550,
        product_height: 20,
        product_width: 30,
        product_length: 40,
        inventory_id: 987654,
        shipping_account_id: 'ACCOUNT_CUSTOM',
      }),
    );

    await service.executePlan(
      {
        ...basePlan,
        platform: 'shopify',
        eventType: 'order',
        externalOrderId: 'shopify-order-1',
        statusCode: null,
        nextActions: ['create_shopify_fulfillment'],
      },
      {
        id: 'shopify-order-1',
        line_items: [{ id: 'line-item-1', sku: 'SKU-1', quantity: 1 }],
      },
    );

    expect(shopifyClient.createFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({ trackingCompany: 'Viettel Custom' }),
    );
  });
});
