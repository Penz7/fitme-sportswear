import { SyncService } from './sync.service';
import { NotFoundException } from '@nestjs/common';

describe('SyncService', () => {
  function createService() {
    const prisma = {
      syncRun: {
        create: jest.fn().mockResolvedValue({
          id: 'sync-run-1',
          status: 'queued',
          syncType: 'address-mapping-sync',
        }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const testSyncProducer = { enqueue: jest.fn() };
    const productSyncProducer = { enqueue: jest.fn() };
    const addressMappingSyncProducer = { enqueue: jest.fn().mockResolvedValue({}) };
    const sapoToPancakeOrderSyncProducer = {
      enqueue: jest.fn().mockResolvedValue({}),
    };
    const shopifyProductCleanupService = {
      cleanupEmptyProducts: jest.fn().mockResolvedValue({
        checked: 1,
        deletedRemote: 1,
        deletedLocal: 1,
        kept: 0,
        errors: [],
      }),
    };

    return {
      prisma,
      addressMappingSyncProducer,
      sapoToPancakeOrderSyncProducer,
      shopifyProductCleanupService,
      service: new SyncService(
        prisma as any,
        testSyncProducer as any,
        productSyncProducer as any,
        addressMappingSyncProducer as any,
        sapoToPancakeOrderSyncProducer as any,
        shopifyProductCleanupService as any,
      ),
    };
  }

  it('queues address mapping sync and enqueues a worker job', async () => {
    const { service, prisma, addressMappingSyncProducer } = createService();

    await expect(service.createAddressMappingSync()).resolves.toEqual({
      id: 'sync-run-1',
      status: 'queued',
      syncType: 'address-mapping-sync',
    });

    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        syncType: 'address-mapping-sync',
        status: 'queued',
        metadata: {},
      },
    });
    expect(addressMappingSyncProducer.enqueue).toHaveBeenCalledWith({
      syncRunId: 'sync-run-1',
    });
  });

  it('returns an address mapping sync run by id', async () => {
    const { service, prisma } = createService();
    const syncRun = {
      id: 'sync-run-1',
      syncType: 'address-mapping-sync',
      status: 'succeeded',
      metadata: { provinces: 1, districts: 2, wards: 3 },
    };
    prisma.syncRun.findUnique.mockResolvedValue(syncRun);

    await expect(service.getAddressMappingSync('sync-run-1')).resolves.toBe(syncRun);
    expect(prisma.syncRun.findUnique).toHaveBeenCalledWith({
      where: { id: 'sync-run-1' },
    });
  });

  it('throws NotFoundException when address mapping sync id is missing or wrong type', async () => {
    const { service, prisma } = createService();
    prisma.syncRun.findUnique.mockResolvedValue({
      id: 'sync-run-1',
      syncType: 'product-inventory-sync',
    });

    await expect(service.getAddressMappingSync('sync-run-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('queues Sapo to Pancake order sync for a Sapo order id', async () => {
    const { service, prisma, sapoToPancakeOrderSyncProducer } = createService();
    prisma.syncRun.create.mockResolvedValueOnce({
      id: 'sync-run-2',
      status: 'queued',
      syncType: 'sapo-to-pancake-order-sync',
    });

    await expect(service.createSapoToPancakeOrderSync('sapo-order-1')).resolves.toEqual({
      id: 'sync-run-2',
      status: 'queued',
      syncType: 'sapo-to-pancake-order-sync',
    });

    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        syncType: 'sapo-to-pancake-order-sync',
        status: 'queued',
        metadata: { sapoOrderId: 'sapo-order-1' },
      },
    });
    expect(sapoToPancakeOrderSyncProducer.enqueue).toHaveBeenCalledWith({
      syncRunId: 'sync-run-2',
      sapoOrderId: 'sapo-order-1',
    });
  });

  it('queues bulk Sapo to Pancake order sync', async () => {
    const { service, prisma, sapoToPancakeOrderSyncProducer } = createService();
    prisma.syncRun.create.mockResolvedValueOnce({
      id: 'sync-run-3',
      status: 'queued',
      syncType: 'sapo-to-pancake-order-sync',
    });

    await expect(service.createSapoToPancakeOrderBulkSync()).resolves.toEqual({
      id: 'sync-run-3',
      status: 'queued',
      syncType: 'sapo-to-pancake-order-sync',
    });

    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        syncType: 'sapo-to-pancake-order-sync',
        status: 'queued',
        metadata: {},
      },
    });
    expect(sapoToPancakeOrderSyncProducer.enqueue).toHaveBeenCalledWith({
      syncRunId: 'sync-run-3',
    });
  });

  it('queues bulk Sapo to Pancake order sync with filters', async () => {
    const { service, prisma, sapoToPancakeOrderSyncProducer } = createService();
    prisma.syncRun.create.mockResolvedValueOnce({
      id: 'sync-run-4',
      status: 'queued',
      syncType: 'sapo-to-pancake-order-sync',
    });

    const filters = {
      status: 'finalized',
      createdOnMin: '2026-05-01T00:00:00.000Z',
      createdOnMax: '2026-05-30T23:59:59.000Z',
      limit: 25,
    };

    await service.createSapoToPancakeOrderBulkSync(filters);

    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        syncType: 'sapo-to-pancake-order-sync',
        status: 'queued',
        metadata: filters,
      },
    });
    expect(sapoToPancakeOrderSyncProducer.enqueue).toHaveBeenCalledWith({
      syncRunId: 'sync-run-4',
      filters,
    });
  });

  it('returns a Sapo to Pancake order sync run by id', async () => {
    const { service, prisma } = createService();
    const syncRun = {
      id: 'sync-run-2',
      syncType: 'sapo-to-pancake-order-sync',
      status: 'succeeded',
      metadata: { action: 'updated' },
    };
    prisma.syncRun.findUnique.mockResolvedValue(syncRun);

    await expect(service.getSapoToPancakeOrderSync('sync-run-2')).resolves.toBe(
      syncRun,
    );
  });

  it('queues Java-style Sapo top-order sync', async () => {
    const { service, prisma, sapoToPancakeOrderSyncProducer } = createService();
    prisma.syncRun.create.mockResolvedValueOnce({
      id: 'sync-run-5',
      status: 'queued',
      syncType: 'sapo-top-order-sync',
    });

    await expect(service.createSapoTopOrderSync()).resolves.toEqual({
      id: 'sync-run-5',
      status: 'queued',
      syncType: 'sapo-top-order-sync',
    });

    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        syncType: 'sapo-top-order-sync',
        status: 'queued',
        metadata: {},
      },
    });
    expect(sapoToPancakeOrderSyncProducer.enqueue).toHaveBeenCalledWith({
      syncRunId: 'sync-run-5',
      mode: 'top-orders',
    });
  });

  it('queues Sapo log sync', async () => {
    const { service, prisma, sapoToPancakeOrderSyncProducer } = createService();
    prisma.syncRun.create.mockResolvedValueOnce({
      id: 'sync-run-6',
      status: 'queued',
      syncType: 'sapo-log-sync',
    });

    await expect(service.createSapoLogSync()).resolves.toEqual({
      id: 'sync-run-6',
      status: 'queued',
      syncType: 'sapo-log-sync',
    });

    expect(sapoToPancakeOrderSyncProducer.enqueue).toHaveBeenCalledWith({
      syncRunId: 'sync-run-6',
      mode: 'sapo-logs',
    });
  });

  it('runs Shopify product cleanup and stores sync metadata', async () => {
    const { service, prisma, shopifyProductCleanupService } = createService();
    prisma.syncRun.create.mockResolvedValueOnce({
      id: 'sync-run-7',
      status: 'running',
      syncType: 'shopify-product-cleanup-sync',
    });

    await expect(service.createShopifyProductCleanupSync()).resolves.toEqual({
      id: 'sync-run-7',
      status: 'succeeded',
      syncType: 'shopify-product-cleanup-sync',
      metadata: {
        checked: 1,
        deletedRemote: 1,
        deletedLocal: 1,
        kept: 0,
        errors: [],
      },
    });

    expect(shopifyProductCleanupService.cleanupEmptyProducts).toHaveBeenCalledWith();
    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-7' },
      data: {
        status: 'succeeded',
        finishedAt: expect.any(Date),
        metadata: {
          checked: 1,
          deletedRemote: 1,
          deletedLocal: 1,
          kept: 0,
          errors: [],
        },
      },
    });
  });

  it('throws NotFoundException when Sapo to Pancake order sync id is missing or wrong type', async () => {
    const { service, prisma } = createService();
    prisma.syncRun.findUnique.mockResolvedValue({
      id: 'sync-run-2',
      syncType: 'address-mapping-sync',
    });

    await expect(
      service.getSapoToPancakeOrderSync('sync-run-2'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
