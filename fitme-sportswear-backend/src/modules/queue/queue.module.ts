import { BullModule } from '@nestjs/bullmq';
import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddressModule } from '../address/address.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SapoModule } from '../sapo/sapo.module';
import { AddressMappingSyncProcessor } from './processors/address-mapping-sync.processor';
import { ProductSyncProcessor } from './processors/product-sync.processor';
import { SapoToPancakeInventorySyncProcessor } from './processors/sapo-to-pancake-inventory-sync.processor';
import { SapoToPancakeOrderSyncProcessor } from './processors/sapo-to-pancake-order-sync.processor';
import { TestSyncProcessor } from './processors/test-sync.processor';
import { WebhookEventProcessor } from './processors/webhook-event.processor';
import { AddressMappingSyncProducer } from './producers/address-mapping-sync.producer';
import { ProductSyncProducer } from './producers/product-sync.producer';
import { SapoToPancakeInventorySyncProducer } from './producers/sapo-to-pancake-inventory-sync.producer';
import { SapoToPancakeOrderSyncProducer } from './producers/sapo-to-pancake-order-sync.producer';
import { ScheduledSyncProducer } from './producers/scheduled-sync.producer';
import { TestSyncProducer } from './producers/test-sync.producer';
import { WebhookEventProducer } from './producers/webhook-event.producer';
import {
  ADDRESS_MAPPING_SYNC_QUEUE,
  PRODUCT_SYNC_QUEUE,
  SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE,
  SAPO_TO_PANCAKE_ORDER_SYNC_QUEUE,
  SCHEDULED_SYNC_QUEUE,
  TEST_SYNC_QUEUE,
  WEBHOOK_EVENT_QUEUE,
} from './queue.constants';

const queueProducerProviders = [
  TestSyncProducer,
  ProductSyncProducer,
  AddressMappingSyncProducer,
  WebhookEventProducer,
  SapoToPancakeOrderSyncProducer,
  SapoToPancakeInventorySyncProducer,
  ScheduledSyncProducer,
];

const queueProcessorProviders = [
  TestSyncProcessor,
  ProductSyncProcessor,
  AddressMappingSyncProcessor,
  WebhookEventProcessor,
  SapoToPancakeOrderSyncProcessor,
  SapoToPancakeInventorySyncProcessor,
];

export function queueProcessorsEnabled(): boolean {
  return process.env.QUEUE_PROCESSORS_ENABLED !== 'false';
}

export function queueProviders(processorsEnabled = queueProcessorsEnabled()): Provider[] {
  return processorsEnabled
    ? [...queueProducerProviders, ...queueProcessorProviders]
    : queueProducerProviders;
}

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
        },
      }),
    }),
    AddressModule,
    OrdersModule,
    ProductsModule,
    NotificationsModule,
    SapoModule,
    BullModule.registerQueue(
      { name: TEST_SYNC_QUEUE },
      { name: PRODUCT_SYNC_QUEUE },
      { name: ADDRESS_MAPPING_SYNC_QUEUE },
      { name: WEBHOOK_EVENT_QUEUE },
      { name: SAPO_TO_PANCAKE_ORDER_SYNC_QUEUE },
      { name: SAPO_TO_PANCAKE_INVENTORY_SYNC_QUEUE },
      { name: SCHEDULED_SYNC_QUEUE },
    ),
  ],
  providers: queueProviders(),
  exports: [
    BullModule,
    TestSyncProducer,
    ProductSyncProducer,
    AddressMappingSyncProducer,
    WebhookEventProducer,
    SapoToPancakeOrderSyncProducer,
    SapoToPancakeInventorySyncProducer,
    ScheduledSyncProducer,
  ],
})
export class QueueModule {}
