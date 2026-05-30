import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AddressMappingSyncProducer } from '../queue/producers/address-mapping-sync.producer';
import { ProductSyncProducer } from '../queue/producers/product-sync.producer';
import { SapoToPancakeOrderSyncProducer } from '../queue/producers/sapo-to-pancake-order-sync.producer';
import { TestSyncProducer } from '../queue/producers/test-sync.producer';
import { ShopifyProductCleanupService } from '../products/shopify-product-cleanup.service';
import { CreateSapoToPancakeOrderBulkSyncDto } from './dto/sapo-to-pancake-order-sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testSyncProducer: TestSyncProducer,
    private readonly productSyncProducer: ProductSyncProducer,
    private readonly addressMappingSyncProducer: AddressMappingSyncProducer,
    private readonly sapoToPancakeOrderSyncProducer: SapoToPancakeOrderSyncProducer,
    private readonly shopifyProductCleanupService: ShopifyProductCleanupService,
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

  async createAddressMappingSync() {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'address-mapping-sync',
        status: 'queued',
        metadata: {},
      },
    });

    await this.addressMappingSyncProducer.enqueue({ syncRunId: syncRun.id });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async getAddressMappingSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (!syncRun || syncRun.syncType !== 'address-mapping-sync') {
      throw new NotFoundException('Address mapping sync run not found');
    }

    return syncRun;
  }

  async createSapoToPancakeOrderSync(sapoOrderId: string) {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'sapo-to-pancake-order-sync',
        status: 'queued',
        metadata: { sapoOrderId },
      },
    });

    await this.sapoToPancakeOrderSyncProducer.enqueue({
      syncRunId: syncRun.id,
      sapoOrderId,
    });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async createSapoToPancakeOrderBulkSync(
    filters: CreateSapoToPancakeOrderBulkSyncDto = {},
  ) {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'sapo-to-pancake-order-sync',
        status: 'queued',
        metadata: filters as any,
      },
    });

    await this.sapoToPancakeOrderSyncProducer.enqueue({
      syncRunId: syncRun.id,
      ...(Object.keys(filters).length > 0 ? { filters } : {}),
    });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async createSapoTopOrderSync(input: { limit?: number } = {}) {
    const metadata = Object.keys(input).length > 0 ? input : {};
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'sapo-top-order-sync',
        status: 'queued',
        metadata: metadata as any,
      },
    });

    await this.sapoToPancakeOrderSyncProducer.enqueue({
      syncRunId: syncRun.id,
      mode: 'top-orders',
      ...(input.limit ? { topOrder: { limit: input.limit } } : {}),
    });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async createSapoLogSync() {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'sapo-log-sync',
        status: 'queued',
        metadata: {},
      },
    });

    await this.sapoToPancakeOrderSyncProducer.enqueue({
      syncRunId: syncRun.id,
      mode: 'sapo-logs',
    });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async createShopifyProductCleanupSync() {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'shopify-product-cleanup-sync',
        status: 'running',
        startedAt: new Date(),
        metadata: {},
      },
    });

    try {
      const metadata = await this.shopifyProductCleanupService.cleanupEmptyProducts();
      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          metadata: metadata as any,
        },
      });

      return {
        id: syncRun.id,
        status: 'succeeded',
        syncType: syncRun.syncType,
        metadata,
      };
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async getSapoToPancakeOrderSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (
      !syncRun ||
      ![
        'sapo-to-pancake-order-sync',
        'sapo-top-order-sync',
        'sapo-log-sync',
      ].includes(syncRun.syncType)
    ) {
      throw new NotFoundException('Sapo to Pancake order sync run not found');
    }

    return syncRun;
  }
}
