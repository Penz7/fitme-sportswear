import { SyncSchedulerService } from './sync-scheduler.service';

describe('SyncSchedulerService', () => {
  function createService(values: Record<string, unknown>) {
    const configService = {
      get: jest.fn((key: string) => values[key]),
    };
    const scheduledSyncProducer = {
      schedule: jest.fn().mockResolvedValue({}),
    };

    return {
      configService,
      scheduledSyncProducer,
      service: new SyncSchedulerService(
        configService as any,
        scheduledSyncProducer as any,
      ),
    };
  }

  it('does not register repeatable jobs when scheduler is disabled', async () => {
    const { service, scheduledSyncProducer } = createService({
      'sync.scheduler.enabled': false,
    });

    await service.onApplicationBootstrap();

    expect(scheduledSyncProducer.schedule).not.toHaveBeenCalled();
  });

  it('registers enabled repeatable sync jobs from config', async () => {
    const { service, scheduledSyncProducer } = createService({
      'sync.scheduler.enabled': true,
      'sync.scheduler.productCron': '*/15 * * * *',
      'sync.scheduler.addressCron': '0 2 * * *',
      'sync.scheduler.sapoOrderCron': '*/5 * * * *',
      'sync.scheduler.sapoOrderStatus': 'finalized',
      'sync.scheduler.sapoOrderLimit': 25,
      'sync.scheduler.sapoTopOrderCron': '*/10 * * * *',
      'sync.scheduler.sapoTopOrderLimit': 30,
      'sync.scheduler.sapoLogCron': '*/1 * * * *',
    });

    await service.onApplicationBootstrap();

    expect(scheduledSyncProducer.schedule).toHaveBeenCalledTimes(5);
    expect(scheduledSyncProducer.schedule).toHaveBeenCalledWith({
      syncType: 'product-inventory-sync',
      cron: '*/15 * * * *',
    });
    expect(scheduledSyncProducer.schedule).toHaveBeenCalledWith({
      syncType: 'address-mapping-sync',
      cron: '0 2 * * *',
    });
    expect(scheduledSyncProducer.schedule).toHaveBeenCalledWith({
      syncType: 'sapo-to-pancake-order-sync',
      cron: '*/5 * * * *',
      filters: { status: 'finalized', limit: 25 },
    });
    expect(scheduledSyncProducer.schedule).toHaveBeenCalledWith({
      syncType: 'sapo-top-order-sync',
      cron: '*/10 * * * *',
      topOrder: { limit: 30 },
    });
    expect(scheduledSyncProducer.schedule).toHaveBeenCalledWith({
      syncType: 'sapo-log-sync',
      cron: '*/1 * * * *',
    });
  });

  it('registers comma-separated Sapo order statuses as bulk filters', async () => {
    const { service, scheduledSyncProducer } = createService({
      'sync.scheduler.enabled': true,
      'sync.scheduler.sapoOrderCron': '*/10 * * * * *',
      'sync.scheduler.sapoOrderStatus': 'finalized,cancelled',
      'sync.scheduler.sapoOrderLimit': 5,
    });

    await service.onApplicationBootstrap();

    expect(scheduledSyncProducer.schedule).toHaveBeenCalledWith({
      syncType: 'sapo-to-pancake-order-sync',
      cron: '*/10 * * * * *',
      filters: { statuses: ['finalized', 'cancelled'], limit: 5 },
    });
  });
});
