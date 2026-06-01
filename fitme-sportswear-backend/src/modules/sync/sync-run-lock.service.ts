import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SCHEDULED_SYNC_QUEUE } from '../queue/queue.constants';

@Injectable()
export class SyncRunLockService {
  constructor(
    @InjectQueue(SCHEDULED_SYNC_QUEUE)
    private readonly queue: Queue,
  ) {}

  async withLock<T>(
    lockKey: string,
    ttlMs: number,
    work: () => Promise<T>,
  ): Promise<T | null> {
    const client = await this.queue.client;
    const acquired = await (client as any).set(lockKey, '1', 'PX', ttlMs, 'NX');

    if (acquired !== 'OK') {
      return null;
    }

    try {
      return await work();
    } finally {
      await client.del(lockKey);
    }
  }
}
