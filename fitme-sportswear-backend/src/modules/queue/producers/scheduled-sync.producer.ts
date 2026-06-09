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

    return this.queue.add(SCHEDULED_SYNC_JOB, payload, {
      jobId: `scheduled-sync:${input.syncType}`,
      repeat: { pattern: cron },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
