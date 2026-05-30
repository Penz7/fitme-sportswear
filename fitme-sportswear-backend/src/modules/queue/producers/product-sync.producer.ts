import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PRODUCT_SYNC_JOB, PRODUCT_SYNC_QUEUE } from '../queue.constants';

export interface ProductSyncPayload {
  syncRunId: string;
}

@Injectable()
export class ProductSyncProducer {
  constructor(@InjectQueue(PRODUCT_SYNC_QUEUE) private readonly queue: Queue<ProductSyncPayload>) {}

  async enqueue(payload: ProductSyncPayload) {
    return this.queue.add(PRODUCT_SYNC_JOB, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
