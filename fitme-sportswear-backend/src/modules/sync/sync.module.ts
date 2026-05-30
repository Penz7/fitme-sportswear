import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ProductsModule } from '../products/products.module';
import { ScheduledSyncProcessor } from './scheduled-sync.processor';
import { SyncController } from './sync.controller';
import { SyncSchedulerService } from './sync-scheduler.service';
import { SyncService } from './sync.service';
import { StartupProductSyncService } from './startup-product-sync.service';

@Module({
  imports: [QueueModule, ProductsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncSchedulerService,
    ScheduledSyncProcessor,
    StartupProductSyncService,
  ],
})
export class SyncModule {}
