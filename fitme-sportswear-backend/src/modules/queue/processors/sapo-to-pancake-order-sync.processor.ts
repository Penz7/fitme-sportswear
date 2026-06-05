import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { SapoLogSyncService } from '../../orders/sapo-log-sync.service';
import { SapoTopOrderSyncService } from '../../orders/sapo-top-order-sync.service';
import {
  SapoToPancakeOrderSyncResult,
  SapoToPancakeOrderSyncService,
} from '../../orders/sapo-to-pancake-order-sync.service';
import { SapoClient } from '../../sapo/sapo.client';
import { SapoToPancakeOrderSyncPayload } from '../producers/sapo-to-pancake-order-sync.producer';
import { SAPO_TO_PANCAKE_ORDER_SYNC_QUEUE } from '../queue.constants';

@Processor(SAPO_TO_PANCAKE_ORDER_SYNC_QUEUE, { concurrency: 1 })
export class SapoToPancakeOrderSyncProcessor extends WorkerHost {
  private readonly pageLimit = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly orderSyncService: SapoToPancakeOrderSyncService,
    private readonly topOrderSyncService: SapoTopOrderSyncService,
    private readonly logSyncService: SapoLogSyncService,
  ) {
    super();
  }

  async process(job: Job<SapoToPancakeOrderSyncPayload>) {
    const { syncRunId, sapoOrderId } = job.data;

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const metadata = await this.resolveJobMetadata(job.data);

      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          metadata: metadata as any,
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

  private async resolveJobMetadata(payload: SapoToPancakeOrderSyncPayload) {
    if (payload.mode === 'sapo-logs') {
      return this.logSyncService.syncRecentLogs();
    }

    if (payload.mode === 'top-orders') {
      if (payload.topOrder?.orderType) {
        return this.topOrderSyncService.syncOrderType({
          orderType: payload.topOrder.orderType,
          prefix: payload.topOrder.prefix,
          limit: payload.topOrder.limit,
        });
      }

      return this.topOrderSyncService.syncAllPancakeOrderTypes({
        limit: payload.topOrder?.limit,
      });
    }

    if (payload.sapoOrderId) {
      return this.syncSingleOrder(payload.sapoOrderId);
    }

    return this.syncOrderPages(payload.filters ?? {});
  }

  private async syncSingleOrder(sapoOrderId: string) {
    const response = await this.sapoClient.fetchOrder(sapoOrderId);
    const result = await this.orderSyncService.syncSapoOrder(response.order ?? {});

    return {
      sapoOrderId,
      action: result.action,
      pancakeOrderId: result.pancakeOrderId,
    };
  }

  private async syncOrderPages(
    filters: NonNullable<SapoToPancakeOrderSyncPayload['filters']>,
  ): Promise<{
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    results: SapoToPancakeOrderSyncResult[];
  }> {
    if (filters.statuses && filters.statuses.length > 0) {
      const results: SapoToPancakeOrderSyncResult[] = [];
      let processed = 0;

      for (const status of filters.statuses) {
        const result = await this.syncOrderPages({
          ...filters,
          statuses: undefined,
          status,
        });
        processed += result.processed;
        results.push(...result.results);
      }

      return {
        processed,
        created: results.filter((result) => result.action === 'created').length,
        updated: results.filter((result) => result.action === 'updated').length,
        skipped: results.filter((result) => result.action === 'skipped').length,
        results,
      };
    }

    const results = [];
    let processed = 0;
    let page = 1;
    const limit = filters.limit ?? this.pageLimit;
    const maxOrders = filters.limit ?? null;

    while (true) {
      const response = await this.sapoClient.fetchOrders({
        page,
        limit,
        status: filters.status,
        createdOnMin: filters.createdOnMin,
        createdOnMax: filters.createdOnMax,
      });
      const orders = response.orders ?? [];

      if (orders.length === 0) {
        break;
      }

      for (const order of orders) {
        const result = await this.orderSyncService.syncSapoOrder(order);
        results.push(result);
      }

      processed += orders.length;

      if (maxOrders !== null && processed >= maxOrders) {
        break;
      }

      if (response.metadata?.total !== undefined && processed >= response.metadata.total) {
        break;
      }

      page += 1;
    }

    return {
      processed,
      created: results.filter((result) => result.action === 'created').length,
      updated: results.filter((result) => result.action === 'updated').length,
      skipped: results.filter((result) => result.action === 'skipped').length,
      results,
    };
  }
}
