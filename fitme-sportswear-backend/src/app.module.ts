import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { PancakeModule } from './modules/pancake/pancake.module';
import { PreorderModule } from './modules/preorder/preorder.module';
import { QueueModule } from './modules/queue/queue.module';
import { SapoModule } from './modules/sapo/sapo.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { SyncModule } from './modules/sync/sync.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    QueueModule,
    SapoModule,
    PancakeModule,
    PreorderModule,
    ShopifyModule,
    SyncModule,
    WebhookModule,
  ],
})
export class AppModule {}
