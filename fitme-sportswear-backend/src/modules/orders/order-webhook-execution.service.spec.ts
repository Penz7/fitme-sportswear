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
      },
    };
    const sapoClient = {
      createOrder: jest.fn().mockResolvedValue({ order: { id: 'sapo-order-1' } }),
      fetchCustomers: jest.fn().mockResolvedValue({ customers: [] }),
      createCustomer: jest.fn().mockResolvedValue({ customer: { id: 12345 } }),
      finalizeOrder: jest.fn().mockResolvedValue({}),
      prepayOrder: jest.fn().mockResolvedValue({}),
      fetchOrder: jest.fn().mockResolvedValue({
        order: {
          id: 'sapo-order-1',
          order_line_items: [{ id: 'sapo-line-1', sku: 'SKU-1', product_name: 'Shirt', price: 150000 }],
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
        const values: Record<string, string | number | undefined> = {
          'sapo.locationId': '572310',
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
    const pancakeToSapoPreflightService = {
      preflight: jest.fn().mockResolvedValue({
        valid: true,
        errors: [],
        sapoOrder: {
          code: 'AUTO_PANCAKE_pancake-order-1',
          total: 300000,
          note: 'call first',
          tags: [],
          shipping_address: {
            full_name: 'Nguyen Van A',
            phone_number: '0909000000',
            full_address: 'Ho Chi Minh',
            ward: 'Ward',
          },
          email: null,
          phone_number: '0909000000',
          customer_data: {
            name: 'Nguyen Van A',
            tags: [],
            addresses: [{ full_address: 'Ho Chi Minh' }],
          },
          order_line_items: [
            {
              sku: 'SKU-1',
              quantity: 2,
              price: 150000,
              product_id: 'sapo-product-1',
              variant_id: 'sapo-variant-1',
            },
          ],
          status: 'placed',
          source_id: 5632931,
          location_id: 572310,
        },
        prepayment: null,
        preview: {},
      }),
    };

    return {
      prisma,
      sapoClient,
      shopifyClient,
      addressMappingService,
      configService,
      pancakeToSapoPreflightService,
      service: new OrderWebhookExecutionService(
        prisma as any,
        sapoClient as any,
        shopifyClient as any,
        addressMappingService as any,
        configService as any,
        pancakeToSapoPreflightService as any,
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

    expect(sapoClient.createOrder).toHaveBeenCalledWith({
      order: expect.objectContaining({
        code: 'AUTO_PANCAKE_pancake-order-1',
        customer_id: 12345,
        total: 300000,
        status: 'placed',
        phone_number: '0909000000',
        order_line_items: [
          expect.objectContaining({
            sku: 'SKU-1',
            quantity: 2,
            product_id: 'sapo-product-1',
            variant_id: 'sapo-variant-1',
          }),
        ],
      }),
    });
    expect(sapoClient.fetchCustomers).toHaveBeenCalledWith(1, 1, '0909000000');
    expect(sapoClient.createCustomer).toHaveBeenCalledWith({
      customer: expect.objectContaining({
        phone_number: '0909000000',
        name: 'Nguyen Van A',
      }),
    });
    expect(sapoClient.finalizeOrder).toHaveBeenCalledWith('sapo-order-1');
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 0,
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 0,
      }),
    });
  });

  it('rejects Pancake order creation before any Sapo write when preflight fails', async () => {
    const { service, sapoClient, pancakeToSapoPreflightService } =
      createService();
    pancakeToSapoPreflightService.preflight.mockResolvedValue({
      valid: false,
      errors: ['SKU SKU-1 is missing a complete Sapo product mapping'],
      sapoOrder: null,
      prepayment: null,
      preview: {},
    });

    await expect(
      service.executePlan(basePlan, { id: 'pancake-order-1' }),
    ).rejects.toThrow(
      'Pancake-to-Sapo preflight failed: SKU SKU-1 is missing a complete Sapo product mapping',
    );

    expect(sapoClient.createOrder).not.toHaveBeenCalled();
    expect(sapoClient.createCustomer).not.toHaveBeenCalled();
    expect(sapoClient.prepayOrder).not.toHaveBeenCalled();
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
      fallbackWardName: 'Xa Xuan Thoi Thuong',
    });
    expect(addressMappingService.resolvePancakeAddress).toHaveBeenCalledWith({
      provinceId: 2,
      districtId: 55,
      wardId: 947,
      fallbackProvinceId: 2,
      fallbackDistrictId: 55,
      fallbackWardId: 947,
      fallbackWardName: null,
    });
    expect(sapoClient.shipFulfillment).toHaveBeenCalledWith(
      'sapo-order-1',
      'fulfillment-1',
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
