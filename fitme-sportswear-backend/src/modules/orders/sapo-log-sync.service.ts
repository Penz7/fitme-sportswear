import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SapoClient, SapoLogEvent } from '../sapo/sapo.client';
import { SapoToPancakeOrderSyncService } from './sapo-to-pancake-order-sync.service';

@Injectable()
export class SapoLogSyncService {
  private readonly scope = 'sapo-log';
  private readonly page = 1;
  private readonly limit = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly orderSyncService: SapoToPancakeOrderSyncService,
  ) {}

  async syncRecentLogs() {
    const response = await this.sapoClient.fetchLogs(this.page, this.limit);
    const newEvents = [];

    for (const event of response.logs ?? []) {
      const key = String(event.id);
      const existing = await this.idempotencyKey.findUnique({
        where: { key_scope: { key, scope: this.scope } },
      });

      if (!existing) {
        newEvents.push(event);
      }
    }

    const extractedOrderIds = this.extractOrderIds(newEvents);
    const results = [];

    for (const orderId of extractedOrderIds) {
      const response = await this.sapoClient.fetchOrder(orderId);
      results.push(await this.orderSyncService.syncSapoOrder(response.order ?? {}));
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    for (const event of newEvents) {
      await this.idempotencyKey.create({
        data: {
          key: String(event.id),
          scope: this.scope,
          expiresAt,
        },
      });
    }

    return {
      fetchedLogIds: response.ids?.length ?? 0,
      newLogIds: newEvents.length,
      extractedOrderIds,
      processed: results.length,
      results,
    };
  }

  extractOrderIds(events: SapoLogEvent[]): string[] {
    const ids = new Set<string>();

    for (const event of events) {
      const orderId = this.extractOrderId(event);
      if (orderId) {
        ids.add(orderId);
      }
    }

    return [...ids];
  }

  private extractOrderId(event: SapoLogEvent): string | null {
    const uri = event.uri ?? '';

    if (uri.includes('orders.json')) {
      return this.stringOrNull(event.root_id ?? event.rootId);
    }

    const match = uri.match(/\/orders\/(\d+)/);
    return match?.[1] ?? null;
  }

  private stringOrNull(value: unknown): string | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return null;
    }

    return String(value);
  }

  private get idempotencyKey() {
    return (this.prisma as any).idempotencyKey;
  }
}
