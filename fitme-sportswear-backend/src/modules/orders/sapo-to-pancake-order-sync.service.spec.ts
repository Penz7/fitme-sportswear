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

  it('updates mapped Pancake order and refreshes mapping status', async () => {
    const { service, prisma, pancakeClient } = createService();
    prisma.orderMapping.findFirst.mockResolvedValue({
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    await expect(service.syncSapoOrder(sapoOrder)).resolves.toEqual({
      action: 'updated',
      sapoOrderId: 'sapo-order-1',
      pancakeOrderId: 'pancake-order-1',
    });

    expect(pancakeClient.updateOrder).toHaveBeenCalledWith(
      'pancake-order-1',
      pancakePayload,
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
