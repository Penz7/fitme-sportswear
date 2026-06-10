import { ScheduledSyncProcessor } from './scheduled-sync.processor';

describe('ScheduledSyncProcessor', () => {
  function createProcessor() {
    const syncService = {
      createProductSync: jest.fn().mockResolvedValue({ id: 'product-run' }),
      createSapoToPancakeInventorySync: jest
        .fn()
        .mockResolvedValue({ id: 'inventory-run' }),
      createAddressMappingSync: jest.fn().mockResolvedValue({ id: 'address-run' }),
      createSapoToPancakeOrderBulkSync: jest
        .fn()
        .mockResolvedValue({ id: 'order-run' }),
      createSapoTopOrderSync: jest.fn().mockResolvedValue({ id: 'top-order-run' }),
      createSapoLogSync: jest.fn().mockResolvedValue({ id: 'log-run' }),
    };

    const notifier = {
      sendException: jest.fn().mockResolvedValue(undefined),
    };
    const lockService = {
      withLock: jest.fn((_: string, __: number, work: () => Promise<unknown>) => work()),
    };

    return {
      syncService,
      notifier,
      lockService,
      processor: new ScheduledSyncProcessor(syncService as any, lockService as any, notifier as any),
    };
  }

  it('creates product sync run for product schedule triggers', async () => {
    const { processor, syncService } = createProcessor();

    await processor.process({
      data: { syncType: 'product-inventory-sync' },
    } as any);

    expect(syncService.createProductSync).toHaveBeenCalledWith();
  });

  it('uses a scheduler-specific lock key for inventory schedule triggers', async () => {
    const { processor, lockService } = createProcessor();

    await processor.process({
      data: { syncType: 'sapo-to-pancake-inventory-sync' },
    } as any);

    expect(lockService.withLock).toHaveBeenCalledWith(
      'lock:schedule:sapo-to-pancake-inventory-sync',
      30 * 60 * 1000,
      expect.any(Function),
    );
  });

  it('creates address mapping sync run for address schedule triggers', async () => {
    const { processor, syncService } = createProcessor();

    await processor.process({
      data: { syncType: 'address-mapping-sync' },
    } as any);

    expect(syncService.createAddressMappingSync).toHaveBeenCalledWith();
  });

  it('creates Sapo order bulk sync run with filters for order schedule triggers', async () => {
    const { processor, syncService } = createProcessor();

    await processor.process({
      data: {
        syncType: 'sapo-to-pancake-order-sync',
        filters: { status: 'finalized', limit: 25 },
      },
    } as any);

    expect(syncService.createSapoToPancakeOrderBulkSync).toHaveBeenCalledWith({
      status: 'finalized',
      limit: 25,
    });
  });

  it('creates Java-style Sapo top-order sync run for top-order schedule triggers', async () => {
    const { processor, syncService } = createProcessor();

    await processor.process({
      data: {
        syncType: 'sapo-top-order-sync',
        topOrder: { limit: 25 },
      },
    } as any);

    expect(syncService.createSapoTopOrderSync).toHaveBeenCalledWith({
      limit: 25,
    });
  });

  it('creates Sapo log sync run for log schedule triggers', async () => {
    const { processor, syncService } = createProcessor();

    await processor.process({
      data: { syncType: 'sapo-log-sync' },
    } as any);

    expect(syncService.createSapoLogSync).toHaveBeenCalledWith();
  });

  it('notifies and rethrows when a scheduled sync fails', async () => {
    const { processor, syncService, notifier } = createProcessor();
    syncService.createProductSync.mockRejectedValueOnce(new Error('product sync failed'));

    await expect(
      processor.process({ data: { syncType: 'product-inventory-sync' } } as any),
    ).rejects.toThrow('product sync failed');

    expect(notifier.sendException).toHaveBeenCalledWith(
      'Scheduled sync failed: product-inventory-sync',
      expect.any(Error),
    );
  });

  it('fails fast for unsupported scheduled sync type', async () => {
    const { processor, notifier } = createProcessor();

    await expect(
      processor.process({ data: { syncType: 'unknown-sync' } } as any),
    ).rejects.toThrow('Unsupported scheduled sync type: unknown-sync');
    expect(notifier.sendException).toHaveBeenCalledWith(
      'Scheduled sync failed: unknown-sync',
      expect.any(Error),
    );
  });
});
