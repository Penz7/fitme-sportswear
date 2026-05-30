import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsModule } from '../products/products.module';
import { ProductSyncProcessor } from './processors/product-sync.processor';
import { TestSyncProcessor } from './processors/test-sync.processor';
import { ProductSyncProducer } from './producers/product-sync.producer';
import { TestSyncProducer } from './producers/test-sync.producer';
import { PRODUCT_SYNC_QUEUE, TEST_SYNC_QUEUE } from './queue.constants';

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
    ProductsModule,
    BullModule.registerQueue({ name: TEST_SYNC_QUEUE }, { name: PRODUCT_SYNC_QUEUE }),
  ],
  providers: [TestSyncProducer, TestSyncProcessor, ProductSyncProducer, ProductSyncProcessor],
  exports: [TestSyncProducer, ProductSyncProducer],
})
export class QueueModule {}
