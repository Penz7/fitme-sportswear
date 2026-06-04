import { Module } from '@nestjs/common';
import { AddressModule } from '../address/address.module';
import { PancakeModule } from '../pancake/pancake.module';
import { SapoModule } from '../sapo/sapo.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { OrderInventoryImpactService } from './order-inventory-impact.service';
import { OrderPreflightController } from './order-preflight.controller';
import { PancakeToSapoPreflightService } from './pancake-to-sapo-preflight.service';
import { OrderWebhookExecutionService } from './order-webhook-execution.service';
import { OrderWebhookProcessingService } from './order-webhook-processing.service';
import { SapoLogSyncService } from './sapo-log-sync.service';
import { SapoTopOrderSyncService } from './sapo-top-order-sync.service';
import { SapoToPancakeOrderMapper } from './sapo-to-pancake-order.mapper';
import { SapoToPancakeOrderSyncService } from './sapo-to-pancake-order-sync.service';

@Module({
  imports: [AddressModule, PancakeModule, SapoModule, ShopifyModule],
  controllers: [OrderPreflightController],
  providers: [
    OrderWebhookProcessingService,
    OrderWebhookExecutionService,
    OrderInventoryImpactService,
    PancakeToSapoPreflightService,
    SapoLogSyncService,
    SapoTopOrderSyncService,
    SapoToPancakeOrderMapper,
    SapoToPancakeOrderSyncService,
  ],
  exports: [
    OrderWebhookProcessingService,
    OrderWebhookExecutionService,
    OrderInventoryImpactService,
    PancakeToSapoPreflightService,
    SapoLogSyncService,
    SapoTopOrderSyncService,
    SapoToPancakeOrderMapper,
    SapoToPancakeOrderSyncService,
  ],
})
export class OrdersModule {}
