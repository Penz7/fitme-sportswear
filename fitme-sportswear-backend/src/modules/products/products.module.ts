import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PancakeModule } from '../pancake/pancake.module';
import { SapoModule } from '../sapo/sapo.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';
import { ProductSyncOrchestratorService } from './product-sync-orchestrator.service';
import { ShopifyProductCleanupService } from './shopify-product-cleanup.service';
import { ProductSyncBlocklistService } from './product-sync-blocklist.service';
import { SapoToPancakeInventorySyncService } from './sapo-to-pancake-inventory-sync.service';

@Module({
  imports: [SapoModule, PancakeModule, ShopifyModule, NotificationsModule],
  providers: [
    ProductSnapshotService,
    ProductMatchingService,
    InventorySyncService,
    ProductSyncOrchestratorService,
    ShopifyProductCleanupService,
    ProductSyncBlocklistService,
    SapoToPancakeInventorySyncService,
  ],
  exports: [
    ProductSyncOrchestratorService,
    ShopifyProductCleanupService,
    SapoToPancakeInventorySyncService,
  ],
})
export class ProductsModule {}
