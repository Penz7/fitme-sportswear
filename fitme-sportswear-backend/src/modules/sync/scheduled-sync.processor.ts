import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ScheduledSyncPayload } from '../queue/producers/scheduled-sync.producer';
import { SCHEDULED_SYNC_QUEUE } from '../queue/queue.constants';
import { TelegramNotifierService } from '../notifications/telegram-notifier.service';
import { SyncService } from './sync.service';

@Processor(SCHEDULED_SYNC_QUEUE, { concurrency: 1 })
export class ScheduledSyncProcessor extends WorkerHost {
  constructor(
    private readonly syncService: SyncService,
    private readonly notifier?: TelegramNotifierService,
  ) {
    super();
  }

  async process(job: Job<ScheduledSyncPayload>) {
    try {
      switch (job.data.syncType) {
        case 'product-inventory-sync':
          return await this.syncService.createProductSync();
        case 'address-mapping-sync':
          return await this.syncService.createAddressMappingSync();
        case 'sapo-to-pancake-order-sync':
          return await this.syncService.createSapoToPancakeOrderBulkSync(
            job.data.filters ?? {},
          );
        case 'sapo-top-order-sync':
          return await this.syncService.createSapoTopOrderSync(job.data.topOrder ?? {});
        case 'sapo-log-sync':
          return await this.syncService.createSapoLogSync();
        default:
          throw new Error(`Unsupported scheduled sync type: ${job.data.syncType}`);
      }
    } catch (error) {
      await this.notifier?.sendException(
        `Scheduled sync failed: ${job.data.syncType}`,
        error,
      );
      throw error;
    }
  }
}
