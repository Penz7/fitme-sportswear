import { StartupProductSyncService } from './startup-product-sync.service';

describe('StartupProductSyncService', () => {
  function createService(enabled: boolean | string | undefined) {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'sync.startup.productSyncEnabled' ? enabled : undefined,
      ),
    };
    const syncService = {
      createProductSync: jest.fn().mockResolvedValue({ id: 'sync-run-1' }),
    };

    return {
      syncService,
      service: new StartupProductSyncService(configService as any, syncService as any),
    };
  }

  it('does not trigger product sync on startup unless enabled', async () => {
    const { service, syncService } = createService(false);

    await service.onApplicationBootstrap();

    expect(syncService.createProductSync).not.toHaveBeenCalled();
  });

  it('triggers product sync on startup when enabled', async () => {
    const { service, syncService } = createService(true);

    await service.onApplicationBootstrap();

    expect(syncService.createProductSync).toHaveBeenCalledWith();
  });
});
