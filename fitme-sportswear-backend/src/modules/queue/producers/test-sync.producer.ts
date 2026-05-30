import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { TEST_SYNC_JOB, TEST_SYNC_QUEUE } from '../queue.constants';

export interface TestSyncPayload {
  syncRunId: string;
  message: string;
}

@Injectable()
export class TestSyncProducer {
  constructor(@InjectQueue(TEST_SYNC_QUEUE) private readonly queue: Queue<TestSyncPayload>) {}

  async enqueue(payload: TestSyncPayload) {
    return this.queue.add(TEST_SYNC_JOB, payload, {
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
