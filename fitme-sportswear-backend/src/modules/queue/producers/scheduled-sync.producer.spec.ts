import { ScheduledSyncProducer } from './scheduled-sync.producer';
import { SCHEDULED_SYNC_JOB } from '../queue.constants';

describe('ScheduledSyncProducer', () => {
  it('registers repeatable scheduled sync jobs with stable job ids', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn(),
    };
    const producer = new ScheduledSyncProducer(queue as any);

    await producer.schedule({
      syncType: 'product-inventory-sync',
      cron: '*/15 * * * *',
    });

    expect(queue.add).toHaveBeenCalledWith(
      SCHEDULED_SYNC_JOB,
      { syncType: 'product-inventory-sync' },
      {
        jobId: 'scheduled-sync:product-inventory-sync',
        repeat: {
          pattern: '*/15 * * * *',
          key: 'scheduled-sync-product-inventory-sync',
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    expect(queue.getRepeatableJobs).toHaveBeenCalled();
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it('passes Sapo order bulk filters to the repeatable job payload', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn(),
    };
    const producer = new ScheduledSyncProducer(queue as any);

    await producer.schedule({
      syncType: 'sapo-to-pancake-order-sync',
      cron: '*/5 * * * *',
      filters: { status: 'finalized', limit: 25 },
    });

    expect(queue.add).toHaveBeenCalledWith(
      SCHEDULED_SYNC_JOB,
      {
        syncType: 'sapo-to-pancake-order-sync',
        filters: { status: 'finalized', limit: 25 },
      },
      expect.objectContaining({
        jobId: 'scheduled-sync:sapo-to-pancake-order-sync',
        repeat: {
          pattern: '*/5 * * * *',
          key: 'scheduled-sync-sapo-to-pancake-order-sync',
        },
      }),
    );
  });

  it('uses a distinct repeatable job id for Shopify top-order polling', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([]),
      removeRepeatableByKey: jest.fn(),
    };
    const producer = new ScheduledSyncProducer(queue as any);

    await producer.schedule({
      syncType: 'sapo-top-order-sync',
      cron: '*/10 * * * *',
      topOrder: { prefix: 'AUTO_SHOPIFY', limit: 30 },
    });

    expect(queue.add).toHaveBeenCalledWith(
      SCHEDULED_SYNC_JOB,
      {
        syncType: 'sapo-top-order-sync',
        topOrder: { prefix: 'AUTO_SHOPIFY', limit: 30 },
      },
      expect.objectContaining({
        jobId: 'scheduled-sync:sapo-top-order-sync:AUTO_SHOPIFY',
        repeat: {
          pattern: '*/10 * * * *',
          key: 'scheduled-sync-sapo-top-order-sync-AUTO_SHOPIFY',
        },
      }),
    );
  });

  it('removes stale repeatable jobs with the same stable job id before registering', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({}),
      getRepeatableJobs: jest.fn().mockResolvedValue([
        {
          key: 'scheduled-sync:shopify-order-reconciliation-sync',
          name: SCHEDULED_SYNC_JOB,
          pattern: '*/2 * * * *',
        },
        {
          key: 'scheduled-sync-shopify-order-reconciliation-sync',
          name: SCHEDULED_SYNC_JOB,
          pattern: '*/10 * * * * *',
        },
        {
          key: 'legacy-shopify-reconciliation-key',
          name: SCHEDULED_SYNC_JOB,
          pattern: '*/10 * * * * *',
        },
        {
          key: 'legacy-shopify-two-minute-key',
          name: SCHEDULED_SYNC_JOB,
          pattern: '*/2 * * * *',
        },
        {
          key: 'other-repeat-key',
          name: SCHEDULED_SYNC_JOB,
          pattern: '*/10 * * * *',
        },
      ]),
      removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    };
    const producer = new ScheduledSyncProducer(queue as any);

    await producer.schedule({
      syncType: 'shopify-order-reconciliation-sync',
      cron: '*/2 * * * *',
    });

    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'scheduled-sync:shopify-order-reconciliation-sync',
    );
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'scheduled-sync-shopify-order-reconciliation-sync',
    );
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'legacy-shopify-reconciliation-key',
    );
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'legacy-shopify-two-minute-key',
    );
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalledWith('other-repeat-key');
    expect(queue.add).toHaveBeenCalledWith(
      SCHEDULED_SYNC_JOB,
      { syncType: 'shopify-order-reconciliation-sync' },
      expect.objectContaining({
        jobId: 'scheduled-sync:shopify-order-reconciliation-sync',
        repeat: {
          pattern: '*/2 * * * *',
          key: 'scheduled-sync-shopify-order-reconciliation-sync',
        },
      }),
    );
  });
});
