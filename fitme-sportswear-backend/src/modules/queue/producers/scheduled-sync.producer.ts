import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SCHEDULED_SYNC_JOB, SCHEDULED_SYNC_QUEUE } from '../queue.constants';

export type ScheduledSyncType =
  | 'product-inventory-sync'
  | 'sapo-to-pancake-inventory-sync'
  | 'address-mapping-sync'
  | 'sapo-to-pancake-order-sync'
  | 'sapo-top-order-sync'
  | 'shopify-order-reconciliation-sync'
  | 'sapo-log-sync';

export interface ScheduledSyncPayload {
  syncType: ScheduledSyncType;
  filters?: {
    status?: string;
    createdOnMin?: string;
    createdOnMax?: string;
    limit?: number;
  };
  topOrder?: {
    prefix?: string;
    limit?: number;
  };
  shopifyOrders?: {
    limit?: number;
  };
}

export interface ScheduledSyncRegistration extends ScheduledSyncPayload {
  cron: string;
}

@Injectable()
export class ScheduledSyncProducer {
  constructor(
    @InjectQueue(SCHEDULED_SYNC_QUEUE)
    private readonly queue: Queue<ScheduledSyncPayload>,
  ) {}

  async schedule(input: ScheduledSyncRegistration) {
    const { cron, ...payload } = input;
    const jobId = this.repeatableJobId(input);
    const repeatKey = this.repeatableKey(input);

    await this.removeExistingRepeatableJobs(input, jobId, repeatKey);

    return this.queue.add(SCHEDULED_SYNC_JOB, payload, {
      jobId,
      repeat: { pattern: cron, key: repeatKey },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  private repeatableJobId(input: ScheduledSyncRegistration): string {
    const suffix = input.topOrder?.prefix ? `:${input.topOrder.prefix}` : '';
    return `scheduled-sync:${input.syncType}${suffix}`;
  }

  private repeatableKey(input: ScheduledSyncRegistration): string {
    const suffix = input.topOrder?.prefix ? `-${input.topOrder.prefix}` : '';
    return `scheduled-sync-${input.syncType}${suffix}`;
  }

  private async removeExistingRepeatableJobs(
    input: ScheduledSyncRegistration,
    jobId: string,
    repeatKey: string,
  ): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();

    await Promise.all(
      repeatableJobs
        .filter((job) => this.isSameRepeatableJob(input, jobId, repeatKey, job))
        .map((job) => this.queue.removeRepeatableByKey(job.key)),
    );
  }

  private isSameRepeatableJob(
    input: ScheduledSyncRegistration,
    jobId: string,
    repeatKey: string,
    job: {
      key: string;
      id?: string | null;
      name?: string;
      pattern?: string | null;
    },
  ): boolean {
    if (job.key === jobId || job.key === repeatKey || job.id === jobId) {
      return true;
    }

    if (
      input.syncType !== 'shopify-order-reconciliation-sync' ||
      job.name !== SCHEDULED_SYNC_JOB
    ) {
      return false;
    }

    return (
      job.pattern === '*/10 * * * * *' ||
      (job.pattern === input.cron && job.key !== repeatKey)
    );
  }
}
