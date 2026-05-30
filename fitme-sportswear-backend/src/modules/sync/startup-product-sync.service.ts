import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncService } from './sync.service';

@Injectable()
export class StartupProductSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StartupProductSyncService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly syncService: SyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configBoolean('sync.startup.productSyncEnabled', false)) {
      return;
    }

    const syncRun = await this.syncService.createProductSync();
    this.logger.log(`Queued startup product sync: ${syncRun.id}`);
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }
}
