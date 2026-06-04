import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ShopifyHmacService } from './shopify-hmac.service';
import { WebhookIngestionService } from './webhook-ingestion.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller()
export class WebhookController {
  constructor(
    private readonly ingestionService: WebhookIngestionService,
    private readonly shopifyHmacService: ShopifyHmacService,
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
  ingestLegacyPancakeWebhook(@Body() body: unknown, @Req() request: RequestWithRawBody) {
    this.assertPancakeWebhookEnabled();
    return this.ingestionService.ingestPancake(this.rawPayload(body, request));
  }

  @Post('webhooks/pancake/v1')
  ingestPancakeWebhook(@Body() body: unknown, @Req() request: RequestWithRawBody) {
    this.assertPancakeWebhookEnabled();
    return this.ingestionService.ingestPancake(this.rawPayload(body, request));
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

    return this.ingestionService.ingestShopify(eventType, rawPayload);
  }

  private assertPancakeWebhookEnabled(): void {
    const ingestionEnabled = this.configBoolean('webhooks.ingestionEnabled');
    const pancakeEnabled = this.configBoolean('webhooks.pancake.enabled');

    if (!ingestionEnabled || !pancakeEnabled) {
      throw new ServiceUnavailableException('Pancake webhook ingestion is disabled');
    }
  }

  private configBoolean(key: string): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
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
