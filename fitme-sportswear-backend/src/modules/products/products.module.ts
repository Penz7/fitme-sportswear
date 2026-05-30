import { Module } from '@nestjs/common';
import { PancakeModule } from '../pancake/pancake.module';
import { SapoModule } from '../sapo/sapo.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';
import { ProductSyncOrchestratorService } from './product-sync-orchestrator.service';
import { ShopifyProductCleanupService } from './shopify-product-cleanup.service';

@Module({
  imports: [SapoModule, PancakeModule, ShopifyModule],
  providers: [
    ProductSnapshotService,
    ProductMatchingService,
    InventorySyncService,
    ProductSyncOrchestratorService,
    ShopifyProductCleanupService,
  ],
  exports: [ProductSyncOrchestratorService, ShopifyProductCleanupService],
})
export class ProductsModule {}
