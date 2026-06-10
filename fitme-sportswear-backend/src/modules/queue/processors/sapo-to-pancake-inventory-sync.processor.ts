import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { SapoToPancakeInventorySyncService } from '../../products/sapo-to-pancake-inventory-sync.service';
import { SapoToPancakeInventorySyncPayload } from '../producers/sapo-to-pancake-inventory-sync.producer';
import { SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE } from '../queue.constants';

const INVENTORY_SYNC_LOCK_KEY = 'lock:sync:sapo-to-pancake-inventory-sync';
const INVENTORY_SYNC_LOCK_TTL_MS = 2 * 60 * 1000;
const INVENTORY_SYNC_LOCK_RENEW_INTERVAL_MS = 30 * 1000;
const RENEW_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
  end
  return 0
`;

@Processor(SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE, { concurrency: 1 })
export class SapoToPancakeInventorySyncProcessor extends WorkerHost {
  constructor(
    private readonly inventorySyncService: SapoToPancakeInventorySyncService,
    @InjectQueue(SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE)
    private readonly queue: Queue<SapoToPancakeInventorySyncPayload>,
  ) {
    super();
  }

  async process(job: Job<SapoToPancakeInventorySyncPayload>) {
    const client = await this.queue.client;
    const lockToken = `${process.pid}:${job.id ?? 'unknown'}:${Date.now()}`;
    const acquired = await (client as any).set(
      INVENTORY_SYNC_LOCK_KEY,
      lockToken,
      'PX',
      INVENTORY_SYNC_LOCK_TTL_MS,
      'NX',
    );

    if (acquired !== 'OK') {
      return this.inventorySyncService.skipBecauseAnotherRunActive(job.data);
    }

    const renewalTimer = setInterval(() => {
      void (client as any)
        .eval(
          RENEW_LOCK_SCRIPT,
          1,
          INVENTORY_SYNC_LOCK_KEY,
          lockToken,
          INVENTORY_SYNC_LOCK_TTL_MS,
        )
        .catch(() => undefined);
    }, INVENTORY_SYNC_LOCK_RENEW_INTERVAL_MS);
    renewalTimer.unref();

    try {
      return await this.inventorySyncService.run(job.data);
    } finally {
      clearInterval(renewalTimer);
      const currentToken = await (client as any).get(INVENTORY_SYNC_LOCK_KEY);
      if (currentToken === lockToken) {
        await client.del(INVENTORY_SYNC_LOCK_KEY);
      }
    }
  }
}
