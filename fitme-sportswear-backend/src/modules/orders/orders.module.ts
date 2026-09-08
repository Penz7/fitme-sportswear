import { Module } from '@nestjs/common';
import { AddressModule } from '../address/address.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PancakeModule } from '../pancake/pancake.module';
import { PreorderModule } from '../preorder/preorder.module';
import { SapoModule } from '../sapo/sapo.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { OrderInventoryImpactService } from './order-inventory-impact.service';
import { OrderWebhookExecutionService } from './order-webhook-execution.service';
import { OrderWebhookProcessingService } from './order-webhook-processing.service';
import { SapoLogSyncService } from './sapo-log-sync.service';
import { SapoTopOrderSyncService } from './sapo-top-order-sync.service';
import { SapoToPancakeOrderMapper } from './sapo-to-pancake-order.mapper';
import { SapoToPancakeOrderSyncService } from './sapo-to-pancake-order-sync.service';
import { ShopifyOrderReconciliationService } from './shopify-order-reconciliation.service';

@Module({
  imports: [
    AddressModule,
    NotificationsModule,
    PancakeModule,
    PreorderModule,
    SapoModule,
    ShopifyModule,
  ],
  providers: [
    OrderWebhookProcessingService,
    OrderWebhookExecutionService,
    OrderInventoryImpactService,
    SapoLogSyncService,
    SapoTopOrderSyncService,
    SapoToPancakeOrderMapper,
    SapoToPancakeOrderSyncService,
    ShopifyOrderReconciliationService,
  ],
  exports: [
    OrderWebhookProcessingService,
    OrderWebhookExecutionService,
    OrderInventoryImpactService,
    SapoLogSyncService,
    SapoTopOrderSyncService,
    SapoToPancakeOrderMapper,
    SapoToPancakeOrderSyncService,
    ShopifyOrderReconciliationService,
  ],
})
export class OrdersModule {}
