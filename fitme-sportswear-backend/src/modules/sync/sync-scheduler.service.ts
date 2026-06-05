import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduledSyncProducer } from '../queue/producers/scheduled-sync.producer';

@Injectable()
export class SyncSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly scheduledSyncProducer: ScheduledSyncProducer,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configBoolean('sync.scheduler.enabled', false)) {
      return;
    }

    await this.scheduleIfConfigured(
      'product-inventory-sync',
      this.configString('sync.scheduler.productCron'),
    );
    await this.scheduleIfConfigured(
      'address-mapping-sync',
      this.configString('sync.scheduler.addressCron'),
    );
    await this.scheduleIfConfigured(
      'sapo-to-pancake-order-sync',
      this.configString('sync.scheduler.sapoOrderCron'),
      this.sapoOrderFilters(),
    );
    await this.scheduleIfConfigured(
      'sapo-top-order-sync',
      this.configString('sync.scheduler.sapoTopOrderCron'),
      undefined,
      this.sapoTopOrderOptions(),
    );
    await this.scheduleIfConfigured(
      'sapo-log-sync',
      this.configString('sync.scheduler.sapoLogCron'),
    );
  }

  private async scheduleIfConfigured(
    syncType:
      | 'product-inventory-sync'
      | 'address-mapping-sync'
      | 'sapo-to-pancake-order-sync'
      | 'sapo-top-order-sync'
      | 'sapo-log-sync',
    cron: string | null,
    filters?: { status?: string; statuses?: string[]; limit?: number },
    topOrder?: { limit?: number },
  ): Promise<void> {
    if (!cron) {
      return;
    }

    await this.scheduledSyncProducer.schedule({
      syncType,
      cron,
      ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
      ...(topOrder && Object.keys(topOrder).length > 0 ? { topOrder } : {}),
    });
    this.logger.log(`Registered ${syncType} schedule: ${cron}`);
  }

  private sapoOrderFilters(): {
    status?: string;
    statuses?: string[];
    limit?: number;
  } {
    const filters: { status?: string; statuses?: string[]; limit?: number } =
      {};
    const status = this.configString('sync.scheduler.sapoOrderStatus');
    const limit = this.configNumber('sync.scheduler.sapoOrderLimit');

    if (status) {
      const statuses = status
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (statuses.length > 1) {
        filters.statuses = statuses;
      } else {
        filters.status = statuses[0] ?? status;
      }
    }
    if (limit !== null) {
      filters.limit = limit;
    }

    return filters;
  }

  private sapoTopOrderOptions(): { limit?: number } {
    const options: { limit?: number } = {};
    const limit = this.configNumber('sync.scheduler.sapoTopOrderLimit');

    if (limit !== null) {
      options.limit = limit;
    }

    return options;
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }

  private configString(key: string): string | null {
    const value = this.configService.get<string | undefined>(key);
    return value === undefined || value === null || String(value).trim() === ''
      ? null
      : String(value);
  }

  private configNumber(key: string): number | null {
    const value = this.configService.get<number | string | undefined>(key);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
