import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestSyncProcessor } from './processors/test-sync.processor';
import { TestSyncProducer } from './producers/test-sync.producer';
import { TEST_SYNC_QUEUE } from './queue.constants';

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
    BullModule.registerQueue({ name: TEST_SYNC_QUEUE }),
  ],
  providers: [TestSyncProducer, TestSyncProcessor],
  exports: [TestSyncProducer],
})
export class QueueModule {}
