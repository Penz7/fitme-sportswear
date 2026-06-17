import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopifyClient } from '../shopify/shopify.client';

@Injectable()
export class ShopifyWebhookStartupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ShopifyWebhookStartupService.name);
  private readonly topics = ['orders/create', 'orders/cancelled'];

  constructor(
    private readonly configService: ConfigService,
    private readonly shopifyClient: ShopifyClient,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configBoolean('queue.processorsEnabled', true)) {
      return;
    }

    if (!this.configBoolean('shopify.webhookAutoRegisterEnabled', true)) {
      return;
    }

    const publicBaseUrl = this.configString('shopify.webhookPublicBaseUrl');
    if (!publicBaseUrl) {
      this.logger.log(
        'Skipping Shopify webhook auto-register because SHOPIFY_WEBHOOK_PUBLIC_BASE_URL is not configured',
      );
      return;
    }

    const address = `${publicBaseUrl.replace(/\/$/, '')}/webhooks/shopify/order`;

    for (const topic of this.topics) {
      try {
        const action = await this.shopifyClient.ensureWebhook({
          topic,
          address,
          format: 'json',
        });
        this.logger.log(
          `Shopify webhook ${topic} ${action}: ${address}`,
        );
      } catch (error) {
        this.logger.warn(
          `Shopify webhook ${topic} auto-register failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private configBoolean(key: string, fallback: boolean): boolean {
    const value = this.configService.get<boolean | string | undefined>(key);
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    return value === true || value === 'true';
  }

  private configString(key: string): string | null {
    const value = this.configService.get<string | undefined>(key);
    if (!value?.trim()) {
      return null;
    }

    return value.trim();
  }
}
