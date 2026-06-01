import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PancakeWebhookSecretService } from './pancake-webhook-secret.service';
import { ShopifyHmacService } from './shopify-hmac.service';
import { WebhookController } from './webhook.controller';
import { WebhookIngestionService } from './webhook-ingestion.service';

@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
  providers: [WebhookIngestionService, ShopifyHmacService, PancakeWebhookSecretService],
})
export class WebhookModule {}
