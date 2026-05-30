import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AddressSyncService } from '../../address/address-sync.service';
import { PrismaService } from '../../database/prisma.service';
import { AddressMappingSyncPayload } from '../producers/address-mapping-sync.producer';
import { ADDRESS_MAPPING_SYNC_QUEUE } from '../queue.constants';

@Processor(ADDRESS_MAPPING_SYNC_QUEUE, { concurrency: 1 })
export class AddressMappingSyncProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly addressSyncService: AddressSyncService,
  ) {
    super();
  }

  async process(job: Job<AddressMappingSyncPayload>) {
    const { syncRunId } = job.data;

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const result = await this.addressSyncService.syncAddressMappings();

      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          metadata: result,
        },
      });
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}
