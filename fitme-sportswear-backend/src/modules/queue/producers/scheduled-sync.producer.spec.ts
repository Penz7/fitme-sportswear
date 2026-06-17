import { ScheduledSyncProducer } from './scheduled-sync.producer';
import { SCHEDULED_SYNC_JOB } from '../queue.constants';

describe('ScheduledSyncProducer', () => {
  it('registers repeatable scheduled sync jobs with stable job ids', async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
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
        repeat: { pattern: '*/15 * * * *' },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  });

  it('passes Sapo order bulk filters to the repeatable job payload', async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
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
        repeat: { pattern: '*/5 * * * *' },
      }),
    );
  });

  it('uses a distinct repeatable job id for Shopify top-order polling', async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
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
        repeat: { pattern: '*/10 * * * *' },
      }),
    );
  });
});
