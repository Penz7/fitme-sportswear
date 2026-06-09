import { SapoToPancakeInventorySyncProducer } from './sapo-to-pancake-inventory-sync.producer';
import { SAPO_TO_PANCAKE_INVENTORY_SYNC_JOB } from '../queue.constants';

describe('SapoToPancakeInventorySyncProducer', () => {
  it('does not retry the whole inventory sync job', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    const producer = new SapoToPancakeInventorySyncProducer(queue as any);

    await producer.enqueue({ syncRunId: 'run-1' });

    expect(queue.add).toHaveBeenCalledWith(
      SAPO_TO_PANCAKE_INVENTORY_SYNC_JOB,
      { syncRunId: 'run-1' },
      expect.objectContaining({ attempts: 1 }),
    );
  });
});
