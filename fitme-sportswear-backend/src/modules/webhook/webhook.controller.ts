import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PancakeWebhookSecretService } from './pancake-webhook-secret.service';
import { ShopifyHmacService } from './shopify-hmac.service';
import { WebhookIngestionService } from './webhook-ingestion.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller()
export class WebhookController {
  constructor(
    private readonly ingestionService: WebhookIngestionService,
    private readonly shopifyHmacService: ShopifyHmacService,
    private readonly pancakeWebhookSecretService: PancakeWebhookSecretService,
    private readonly configService: ConfigService,
  ) {}

  @Get('webhooks/internal/status')
  getStatus() {
    return {
      status: 'ready',
      message: 'Webhook ingestion is configured for Pancake and Shopify foundation events.',
    };
  }

  @Post('webhook')
  ingestLegacyPancakeWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-pancake-webhook-secret') secret?: string,
  ) {
    return this.ingestPancakeWebhookPayload(body, request, secret);
  }

  @Post('webhooks/pancake/v1')
  ingestPancakeWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-pancake-webhook-secret') secret?: string,
  ) {
    return this.ingestPancakeWebhookPayload(body, request, secret);
  }

  @Post('webhooks/order')
  ingestLegacyShopifyOrderWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    return this.ingestShopifyWebhook('order', body, request, hmac);
  }

  @Post('webhooks/product')
  ingestLegacyShopifyProductWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    return this.ingestShopifyWebhook('product', body, request, hmac);
  }

  @Post('webhooks/fulfillment')
  ingestLegacyShopifyFulfillmentWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    return this.ingestShopifyWebhook('fulfillment', body, request, hmac);
  }

  @Post('webhooks/shopify/order')
  ingestShopifyOrderWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    return this.ingestShopifyWebhook('order', body, request, hmac);
  }

  @Post('webhooks/shopify/product')
  ingestShopifyProductWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    return this.ingestShopifyWebhook('product', body, request, hmac);
  }

  @Post('webhooks/shopify/fulfillment')
  ingestShopifyFulfillmentWebhook(
    @Body() body: unknown,
    @Req() request: RequestWithRawBody,
    @Headers('x-shopify-hmac-sha256') hmac?: string,
  ) {
    return this.ingestShopifyWebhook('fulfillment', body, request, hmac);
  }

  private ingestPancakeWebhookPayload(
    body: unknown,
    request: RequestWithRawBody,
    secret?: string,
  ) {
    if (!this.pancakeWebhookSecretService.verify(secret)) {
      throw new UnauthorizedException('Invalid Pancake webhook secret');
    }

    if (!this.webhookEnabled('pancake')) {
      return this.disabledResponse('pancake');
    }

    return this.ingestionService.ingestPancake(this.rawPayload(body, request));
  }

  private ingestShopifyWebhook(
    eventType: 'order' | 'product' | 'fulfillment',
    body: unknown,
    request: RequestWithRawBody,
    hmac?: string,
  ) {
    const rawPayload = this.rawPayload(body, request);

    if (!this.shopifyHmacService.verify(hmac, rawPayload)) {
      throw new UnauthorizedException('Invalid Shopify webhook signature');
    }

    if (!this.webhookEnabled('shopify')) {
      return this.disabledResponse('shopify', eventType);
    }

    return this.ingestionService.ingestShopify(eventType, rawPayload);
  }

  private webhookEnabled(platform: 'pancake' | 'shopify'): boolean {
    if (!this.configBoolean('webhook.ingestionEnabled', true)) {
      return false;
    }

    return this.configBoolean(`webhook.${platform}.enabled`, true);
  }

  private disabledResponse(platform: 'pancake' | 'shopify', eventType = 'unknown') {
    return {
      duplicate: false,
      eventType,
      platform,
      status: 'ignored',
      reason: 'WEBHOOK_INGESTION_DISABLED',
    };
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }

  private rawPayload(body: unknown, request: RequestWithRawBody): string {
    if (request.rawBody) {
      return request.rawBody.toString('utf8');
    }

    if (typeof body === 'string') {
      return body;
    }

    return JSON.stringify(body ?? {});
  }
}
