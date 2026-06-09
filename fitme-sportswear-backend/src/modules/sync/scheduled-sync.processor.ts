import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ScheduledSyncPayload } from '../queue/producers/scheduled-sync.producer';
import { SCHEDULED_SYNC_QUEUE } from '../queue/queue.constants';
import { TelegramNotifierService } from '../notifications/telegram-notifier.service';
import { SyncRunLockService } from './sync-run-lock.service';
import { SyncService } from './sync.service';

@Processor(SCHEDULED_SYNC_QUEUE, { concurrency: 5 })
export class ScheduledSyncProcessor extends WorkerHost {
  constructor(
    private readonly syncService: SyncService,
    private readonly lockService?: SyncRunLockService,
    private readonly notifier?: TelegramNotifierService,
  ) {
    super();
  }

  async process(job: Job<ScheduledSyncPayload>) {
    try {
      const run = () => this.runSync(job);
      const lockKey = `lock:sync:${job.data.syncType}`;
      const lockedResult = await this.lockService?.withLock(lockKey, 30 * 60 * 1000, run);

      if (this.lockService && lockedResult === null) {
        return { skipped: true, reason: 'SYNC_ALREADY_RUNNING', syncType: job.data.syncType };
      }

      return this.lockService ? lockedResult : await run();
    } catch (error) {
      await this.notifier?.sendException(
        `Scheduled sync failed: ${job.data.syncType}`,
        error,
      );
      throw error;
    }
  }

  private async runSync(job: Job<ScheduledSyncPayload>) {
    switch (job.data.syncType) {
      case 'product-inventory-sync':
        return await this.syncService.createProductSync();
      case 'sapo-to-pancake-inventory-sync':
        return await this.syncService.createSapoToPancakeInventorySync({
          dryRun: false,
        });
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
  }
}
