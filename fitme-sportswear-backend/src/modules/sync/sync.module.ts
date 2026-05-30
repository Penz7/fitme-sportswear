import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [QueueModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
