import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductSyncProducer } from '../queue/producers/product-sync.producer';
import { TestSyncProducer } from '../queue/producers/test-sync.producer';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testSyncProducer: TestSyncProducer,
    private readonly productSyncProducer: ProductSyncProducer,
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

  async createProductSync() {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'product-inventory-sync',
        status: 'queued',
        metadata: {},
      },
    });

    await this.productSyncProducer.enqueue({ syncRunId: syncRun.id });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async getProductSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (!syncRun || syncRun.syncType !== 'product-inventory-sync') {
      throw new NotFoundException('Product sync run not found');
    }

    return syncRun;
  }
}
