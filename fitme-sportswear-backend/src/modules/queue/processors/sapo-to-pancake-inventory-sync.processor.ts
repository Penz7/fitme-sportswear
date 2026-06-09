import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { SapoToPancakeInventorySyncService } from '../../products/sapo-to-pancake-inventory-sync.service';
import { SapoToPancakeInventorySyncPayload } from '../producers/sapo-to-pancake-inventory-sync.producer';
import { SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE } from '../queue.constants';

const INVENTORY_SYNC_LOCK_KEY = 'lock:sync:sapo-to-pancake-inventory-sync';
const INVENTORY_SYNC_LOCK_TTL_MS = 60 * 60 * 1000;

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

    try {
      return await this.inventorySyncService.run(job.data);
    } finally {
      const currentToken = await (client as any).get(INVENTORY_SYNC_LOCK_KEY);
      if (currentToken === lockToken) {
        await client.del(INVENTORY_SYNC_LOCK_KEY);
      }
    }
  }
}
