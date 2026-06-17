import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { ProductSyncOrchestratorService } from '../../products/product-sync-orchestrator.service';
import { ProductSyncPayload } from '../producers/product-sync.producer';
import { PRODUCT_SYNC_QUEUE } from '../queue.constants';

const PRODUCT_SYNC_LOCK_KEY = 'lock:sync:product-inventory-sync';
const PRODUCT_SYNC_LOCK_TTL_MS = 10 * 60 * 1000;
const PRODUCT_SYNC_LOCK_RENEW_INTERVAL_MS = 30 * 1000;
const RENEW_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('pexpire', KEYS[1], ARGV[2])
  end
  return 0
`;

@Processor(PRODUCT_SYNC_QUEUE, { concurrency: 1 })
export class ProductSyncProcessor extends WorkerHost {
  constructor(
    private readonly orchestrator: ProductSyncOrchestratorService,
    @InjectQueue(PRODUCT_SYNC_QUEUE)
    private readonly queue: Queue<ProductSyncPayload>,
  ) {
    super();
  }

  async process(job: Job<ProductSyncPayload>) {
    const client = await this.queue.client;
    const lockToken = `${process.pid}:${job.id ?? 'unknown'}:${Date.now()}`;
    const acquired = await (client as any).set(
      PRODUCT_SYNC_LOCK_KEY,
      lockToken,
      'PX',
      PRODUCT_SYNC_LOCK_TTL_MS,
      'NX',
    );

    if (acquired !== 'OK') {
      return this.orchestrator.skipBecauseAnotherRunActive(job.data.syncRunId);
    }

    const renewalTimer = setInterval(() => {
      void (client as any)
        .eval(
          RENEW_LOCK_SCRIPT,
          1,
          PRODUCT_SYNC_LOCK_KEY,
          lockToken,
          PRODUCT_SYNC_LOCK_TTL_MS,
        )
        .catch(() => undefined);
    }, PRODUCT_SYNC_LOCK_RENEW_INTERVAL_MS);
    renewalTimer.unref();

    try {
      await this.orchestrator.run(job.data.syncRunId);
    } finally {
      clearInterval(renewalTimer);
      const currentToken = await (client as any).get(PRODUCT_SYNC_LOCK_KEY);
      if (currentToken === lockToken) {
        await client.del(PRODUCT_SYNC_LOCK_KEY);
      }
    }
  }
}
