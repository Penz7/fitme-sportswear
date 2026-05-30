import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { TestSyncPayload } from '../producers/test-sync.producer';
import { TEST_SYNC_QUEUE } from '../queue.constants';

@Processor(TEST_SYNC_QUEUE, { concurrency: 5 })
export class TestSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(TestSyncProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TestSyncPayload>) {
    const { syncRunId, message } = job.data;

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'running',
        startedAt: new Date(),
        metadata: { message, jobId: String(job.id) },
      },
    });

    this.logger.log(`Processed test sync job ${job.id}`);

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
      },
    });
  }
}
