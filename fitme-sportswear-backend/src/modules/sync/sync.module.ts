import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { ProductsModule } from '../products/products.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { ScheduledSyncProcessor } from './scheduled-sync.processor';
import { SyncApiTokenGuard } from './sync-api-token.guard';
import { SyncController } from './sync.controller';
import { SyncRunLockService } from './sync-run-lock.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { SyncService } from './sync.service';
import { ShopifyWebhookStartupService } from './shopify-webhook-startup.service';
import { StartupProductSyncService } from './startup-product-sync.service';

@Module({
  imports: [QueueModule, ProductsModule, NotificationsModule, ShopifyModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncSchedulerService,
    ScheduledSyncProcessor,
    StartupProductSyncService,
    ShopifyWebhookStartupService,
    SyncApiTokenGuard,
    SyncRunLockService,
  ],
})
export class SyncModule {}
