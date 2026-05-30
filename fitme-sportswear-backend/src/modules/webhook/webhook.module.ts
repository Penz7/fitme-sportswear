import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ShopifyHmacService } from './shopify-hmac.service';
import { WebhookController } from './webhook.controller';
import { WebhookIngestionService } from './webhook-ingestion.service';

@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
  providers: [WebhookIngestionService, ShopifyHmacService],
})
export class WebhookModule {}
