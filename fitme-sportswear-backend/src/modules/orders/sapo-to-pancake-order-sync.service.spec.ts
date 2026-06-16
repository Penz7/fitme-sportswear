import { SapoToPancakeOrderSyncService } from './sapo-to-pancake-order-sync.service';

describe('SapoToPancakeOrderSyncService', () => {
  const sapoOrder = {
    id: 'sapo-order-1',
    status: 'draft',
    order_line_items: [{ sku: 'SKU-1', quantity: 1 }],
  };
  const pancakePayload = {
    status: 0,
    status_name: 'Moi',
    items: [{ product_id: 'product-1', variation_id: 'variant-1', quantity: 1 }],
  };

  function createService() {
    const prisma = {
      orderMapping: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      productMapping: {
        findUnique: jest.fn().mockResolvedValue({
          sku: 'SKU-1',
          pancakeVariantId: 'variant-1',
          pancakeWarehouseId: 'warehouse-1',
        }),
      },
    };
    const pancakeClient = {
      createOrder: jest.fn().mockResolvedValue({ data: { id: 'pancake-order-1', status: 0 } }),
      updateOrder: jest.fn().mockResolvedValue({ data: { id: 'pancake-order-1', status: 1 } }),
      updateInventory: jest.fn().mockResolvedValue(undefined),
    };
    const mapper = {
      toPancakeOrder: jest.fn().mockResolvedValue(pancakePayload),
      toPancakeStatusPayload: jest
        .fn()
        .mockReturnValue({ status: 0, status_name: 'Moi' }),
    };
    const configService = {
      get: jest.fn().mockReturnValue(false),
    };
    const addressMappingService = {
      resolvePancakeAddressFromSapoText: jest.fn().mockResolvedValue({
        provinceId: 79,
        districtId: 784,
        wardId: 27523,
      }),
    };

    return {
      prisma,
      pancakeClient,
      mapper,
      configService,
      addressMappingService,
      service: new SapoToPancakeOrderSyncService(
        prisma as any,
        pancakeClient as any,
        mapper as any,
        configService as any,
        addressMappingService as any,
      ),
    };
  }

  it('creates Pancake order and stores mapping when Sapo order is not mapped', async () => {
    const { service, prisma, pancakeClient, mapper } = createService();

    await expect(service.syncSapoOrder(sapoOrder)).resolves.toEqual({
      action: 'created',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(prisma.orderMapping.findFirst).toHaveBeenCalledWith({
      where: { sapoOrderId: 'sapo-order-1' },
    });
    expect(mapper.toPancakeOrder).toHaveBeenCalledWith(sapoOrder, {
      provinceId: 79,
      districtId: 784,
      wardId: 27523,
    });
    expect(pancakeClient.createOrder).toHaveBeenCalledWith(pancakePayload);
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 0,
        pancakeStatusDescription: 'Moi',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 0,
        pancakeStatusDescription: 'Moi',
      }),
    });
  });

  it('updates a mapped Pancake order with the full Sapo-derived payload and refreshes mapping status', async () => {
    const { service, prisma, pancakeClient, mapper } = createService();
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    mapper.toPancakeOrder.mockResolvedValue({
      ...pancakePayload,
      status: 0,
      status_name: 'Moi',
      bill_full_name: 'Updated Receiver',
    });

    await expect(service.syncSapoOrder(sapoOrder)).resolves.toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).toHaveBeenCalledWith(
      'pancake-order-1',
      {
        ...pancakePayload,
        status: 0,
        status_name: 'Moi',
        bill_full_name: 'Updated Receiver',
      },
    );
    expect(mapper.toPancakeOrder).toHaveBeenCalledWith(
      sapoOrder,
      {
        provinceId: 79,
        districtId: 784,
        wardId: 27523,
      },
    );
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 1,
      }),
    });
  });

  it('falls back to status-only updates for a mapped Pancake order when full payload mapping is incomplete', async () => {
    const { service, prisma, pancakeClient, mapper } = createService();
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    mapper.toPancakeOrder.mockResolvedValue(null);
    mapper.toPancakeStatusPayload.mockReturnValue({
      status: 8,
      status_name: 'Dang dong hang',
    });
    mapper.toPancakeOrder.mockResolvedValue({
      status: 8,
      status_name: 'Dang dong hang',
      items: [{ product_id: 'product-1', variation_id: 'variant-1', quantity: 1 }],
    });
    pancakeClient.updateOrder.mockResolvedValue({
      data: { id: 'pancake-order-1', status: 8, status_name: 'Dang dong hang' },
    });

    await expect(
      service.syncSapoOrder({
        ...sapoOrder,
        status: 'finalized',
        packed_status: 'packed',
        fulfillment_status: 'unshipped',
      }),
    ).resolves.toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).toHaveBeenCalledWith(
      'pancake-order-1',
      {
        status: 8,
        status_name: 'Dang dong hang',
        items: [{ product_id: 'product-1', variation_id: 'variant-1', quantity: 1 }],
      },
    );
  });

  it('does not downgrade a mapped Pancake order while Sapo is still catching up', async () => {
    const { service, prisma, pancakeClient, mapper } = createService();
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
      pancakeStatus: 8,
      pancakeStatusDescription: 'Dang dong hang',
    });
    mapper.toPancakeStatusPayload.mockReturnValue({
      status: 1,
      status_name: 'Da xac nhan',
    });

    await expect(
      service.syncSapoOrder({
        ...sapoOrder,
        status: 'finalized',
        packed_status: 'unpacked',
        fulfillment_status: 'unshipped',
      }),
    ).resolves.toEqual({
      action: 'skipped',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).not.toHaveBeenCalled();
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 8,
        pancakeStatusDescription: 'Dang dong hang',
        sapoStatus: 'finalized',
        sapoPackedStatus: 'unpacked',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 8,
        pancakeStatusDescription: 'Dang dong hang',
        sapoStatus: 'finalized',
        sapoPackedStatus: 'unpacked',
      }),
    });
  });

  it('allows correcting a payment-only Pancake status back to the Sapo operational status', async () => {
    const { service, prisma, pancakeClient, mapper } = createService();
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
      pancakeStatus: 16,
      pancakeStatusDescription: 'Da thu tien',
    });
    mapper.toPancakeStatusPayload.mockReturnValue({
      status: 8,
      status_name: 'Dang dong hang',
    });
    mapper.toPancakeOrder.mockResolvedValue({
      status: 8,
      status_name: 'Dang dong hang',
      items: [{ product_id: 'product-1', variation_id: 'variant-1', quantity: 1 }],
    });
    pancakeClient.updateOrder.mockResolvedValue({
      data: { id: 'pancake-order-1', status: 8, status_name: 'Dang dong hang' },
    });

    await expect(
      service.syncSapoOrder({
        ...sapoOrder,
        status: 'finalized',
        packed_status: 'packed',
        fulfillment_status: 'unshipped',
        payment_status: 'paid',
      }),
    ).resolves.toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).toHaveBeenCalledWith(
      'pancake-order-1',
      {
        status: 8,
        status_name: 'Dang dong hang',
        items: [{ product_id: 'product-1', variation_id: 'variant-1', quantity: 1 }],
      },
    );
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        pancakeStatus: 8,
        pancakeStatusDescription: 'Dang dong hang',
        sapoStatus: 'finalized',
        sapoPackedStatus: 'packed',
        sapoPaymentStatus: 'paid',
      }),
      update: expect.objectContaining({
        pancakeStatus: 8,
        pancakeStatusDescription: 'Dang dong hang',
        sapoStatus: 'finalized',
        sapoPackedStatus: 'packed',
        sapoPaymentStatus: 'paid',
      }),
    });
  });

  it('updates a mapped Pancake order to cancelled when the Sapo order is cancelled without manual inventory mutation', async () => {
    const { service, prisma, pancakeClient, mapper, configService } = createService();
    const cancelledSapoOrder = {
      ...sapoOrder,
      status: 'cancelled',
      packed_status: 'unpacked',
      fulfillment_status: 'unshipped',
    };
    const cancelPayload = {
      status: 6,
      status_name: 'Huy don',
    };
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    mapper.toPancakeStatusPayload.mockReturnValue(cancelPayload);
    mapper.toPancakeOrder.mockResolvedValue(cancelPayload);
    pancakeClient.updateOrder.mockResolvedValue({
      data: { id: 'pancake-order-1', status: 6, status_name: 'Huy don' },
    });
    configService.get.mockImplementation((key: string) =>
      key === 'sync.orders.updatePancakeInventoryByOrder' ? true : false,
    );

    await expect(service.syncSapoOrder(cancelledSapoOrder)).resolves.toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).toHaveBeenCalledWith(
      'pancake-order-1',
      cancelPayload,
    );
    expect(mapper.toPancakeOrder).toHaveBeenCalledWith(cancelledSapoOrder, {
      provinceId: 79,
      districtId: 784,
      wardId: 27523,
    });
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 6,
        pancakeStatusDescription: 'Huy don',
        sapoStatus: 'cancelled',
        sapoFulfillmentStatus: 'unshipped',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 6,
        pancakeStatusDescription: 'Huy don',
        sapoStatus: 'cancelled',
        sapoFulfillmentStatus: 'unshipped',
      }),
    });
  });

  it('updates a mapped Pancake order to cancelled even when line item mapping is incomplete', async () => {
    const { service, prisma, pancakeClient, mapper } = createService();
    const cancelledSapoOrder = {
      ...sapoOrder,
      status: 'cancelled',
      packed_status: 'unpacked',
      fulfillment_status: 'unshipped',
    };
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });
    mapper.toPancakeOrder.mockResolvedValue(null);
    mapper.toPancakeStatusPayload.mockReturnValue({
      status: 6,
      status_name: 'Huy don',
    });
    pancakeClient.updateOrder.mockResolvedValue({
      data: { id: 'pancake-order-1', status: 6, status_name: 'Huy don' },
    });

    await expect(service.syncSapoOrder(cancelledSapoOrder)).resolves.toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).toHaveBeenCalledWith(
      'pancake-order-1',
      {
        status: 6,
        status_name: 'Huy don',
      },
    );
    expect(mapper.toPancakeOrder).toHaveBeenCalledWith(cancelledSapoOrder, {
      provinceId: 79,
      districtId: 784,
      wardId: 27523,
    });
    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
    expect(prisma.orderMapping.upsert).toHaveBeenCalledWith({
      where: { pancakeOrderId: 'pancake-order-1' },
      create: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeOrderId: 'pancake-order-1',
        pancakeStatus: 6,
        pancakeStatusDescription: 'Huy don',
        sapoStatus: 'cancelled',
      }),
      update: expect.objectContaining({
        sapoOrderId: 'sapo-order-1',
        pancakeStatus: 6,
        pancakeStatusDescription: 'Huy don',
        sapoStatus: 'cancelled',
      }),
    });
  });

  it('skips sync when mapper cannot build a Pancake payload', async () => {
    const { service, mapper, pancakeClient, prisma } = createService();
    mapper.toPancakeOrder.mockResolvedValue(null);

    await expect(service.syncSapoOrder(sapoOrder)).resolves.toEqual({
      action: 'skipped',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: null,
    });
    expect(pancakeClient.createOrder).not.toHaveBeenCalled();
    expect(prisma.orderMapping.upsert).not.toHaveBeenCalled();
  });

  it('does not update Pancake inventory from Sapo order line quantity when enabled', async () => {
    const { service, configService, pancakeClient } = createService();
    configService.get.mockImplementation((key: string) =>
      key === 'sync.orders.updatePancakeInventoryByOrder' ? true : false,
    );

    await service.syncSapoOrder(sapoOrder);

    expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
  });
});
