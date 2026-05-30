import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TestSyncProducer } from '../queue/producers/test-sync.producer';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testSyncProducer: TestSyncProducer,
  ) {}

  async createTestSync(message = 'test sync') {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'test-sync',
        status: 'queued',
        metadata: { message },
      },
    });

    await this.testSyncProducer.enqueue({ syncRunId: syncRun.id, message });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async getTestSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (!syncRun || syncRun.syncType !== 'test-sync') {
      throw new NotFoundException('Test sync run not found');
    }

    return syncRun;
  }
}
