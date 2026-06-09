import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  SAPO_TO_PANCAKE_INVENTORY_SYNC_JOB,
  SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE,
} from '../queue.constants';

export interface SapoToPancakeInventorySyncPayload {
  syncRunId: string;
  dryRun?: boolean;
  approved?: boolean;
  productIds?: string[];
  skus?: string[];
}

@Injectable()
export class SapoToPancakeInventorySyncProducer {
  constructor(
    @InjectQueue(SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE)
    private readonly queue: Queue<SapoToPancakeInventorySyncPayload>,
  ) {}

  async enqueue(payload: SapoToPancakeInventorySyncPayload) {
    return this.queue.add(SAPO_TO_PANCAKE_INVENTORY_SYNC_JOB, payload, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
