import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  SAPO_TO_PANCAKE_ORDER_SYNC_JOB,
  SAPO_TO_PANCAKE_ORDER_SYNC_QUEUE,
} from '../queue.constants';

export interface SapoToPancakeOrderSyncPayload {
  syncRunId: string;
  mode?: 'single' | 'bulk' | 'top-orders' | 'sapo-logs' | 'shopify-order-reconciliation';
  sapoOrderId?: string;
  filters?: {
    status?: string;
    statuses?: string[];
    createdOnMin?: string;
    createdOnMax?: string;
    limit?: number;
  };
  topOrder?: {
    orderType?: string;
    prefix?: string;
    limit?: number;
  };
  shopifyOrders?: {
    limit?: number;
  };
}

@Injectable()
export class SapoToPancakeOrderSyncProducer {
  constructor(
    @InjectQueue(SAPO_TO_PANCAKE_ORDER_SYNC_QUEUE)
    private readonly queue: Queue<SapoToPancakeOrderSyncPayload>,
  ) {}

  async enqueue(payload: SapoToPancakeOrderSyncPayload) {
    return this.queue.add(SAPO_TO_PANCAKE_ORDER_SYNC_JOB, payload, {
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
