import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  ADDRESS_MAPPING_SYNC_JOB,
  ADDRESS_MAPPING_SYNC_QUEUE,
} from '../queue.constants';

export interface AddressMappingSyncPayload {
  syncRunId: string;
}

@Injectable()
export class AddressMappingSyncProducer {
  constructor(
    @InjectQueue(ADDRESS_MAPPING_SYNC_QUEUE)
    private readonly queue: Queue<AddressMappingSyncPayload>,
  ) {}

  async enqueue(payload: AddressMappingSyncPayload) {
    return this.queue.add(ADDRESS_MAPPING_SYNC_JOB, payload, {
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
