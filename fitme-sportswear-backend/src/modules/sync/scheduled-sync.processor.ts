import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ScheduledSyncPayload } from '../queue/producers/scheduled-sync.producer';
import { SCHEDULED_SYNC_QUEUE } from '../queue/queue.constants';
import { SyncService } from './sync.service';

@Processor(SCHEDULED_SYNC_QUEUE, { concurrency: 1 })
export class ScheduledSyncProcessor extends WorkerHost {
  constructor(private readonly syncService: SyncService) {
    super();
  }

  async process(job: Job<ScheduledSyncPayload>) {
    switch (job.data.syncType) {
      case 'product-inventory-sync':
        return this.syncService.createProductSync();
      case 'address-mapping-sync':
        return this.syncService.createAddressMappingSync();
      case 'sapo-to-pancake-order-sync':
        return this.syncService.createSapoToPancakeOrderBulkSync(
          job.data.filters ?? {},
        );
      case 'sapo-top-order-sync':
        return this.syncService.createSapoTopOrderSync(job.data.topOrder ?? {});
      case 'sapo-log-sync':
        return this.syncService.createSapoLogSync();
      default:
        throw new Error(`Unsupported scheduled sync type: ${job.data.syncType}`);
    }
  }
}
