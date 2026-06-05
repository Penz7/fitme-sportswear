import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { WebhookEventProducer } from '../queue/producers/webhook-event.producer';
import { resolvePancakeWebhookEventType } from '../orders/order-status.mapper';

type WebhookPlatform = 'pancake' | 'shopify';

export interface WebhookIngestionResult {
  id?: string;
  duplicate: boolean;
  eventType: string;
  status: 'queued' | 'ignored';
}

@Injectable()
export class WebhookIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: WebhookEventProducer,
  ) {}

  async ingestPancake(rawPayload: string): Promise<WebhookIngestionResult> {
    const payload = this.parsePayload(rawPayload);
    const eventType = resolvePancakeWebhookEventType(payload);

    return this.ingest({
      platform: 'pancake',
      eventType,
      rawPayload,
      payload,
    });
  }

  async ingestShopify(
    eventType: 'order' | 'product' | 'fulfillment',
    rawPayload: string,
  ): Promise<WebhookIngestionResult> {
    const payload = this.parsePayload(rawPayload);

    return this.ingest({
      platform: 'shopify',
      eventType,
      rawPayload,
      payload,
    });
  }

  private async ingest(input: {
    platform: WebhookPlatform;
    eventType: string;
    rawPayload: string;
    payload: Record<string, unknown>;
  }): Promise<WebhookIngestionResult> {
    const externalEventId = this.resolveExternalEventId(input.payload);
    const idempotencyKey = this.buildIdempotencyKey(
      input.platform,
      input.eventType,
      externalEventId,
      input.rawPayload,
    );
    const scope = `webhook:${input.platform}`;
    const existingKey = await this.prisma.idempotencyKey.findUnique({
      where: {
        key_scope: {
          key: idempotencyKey,
          scope,
        },
      },
    });

    if (existingKey) {
      return {
        duplicate: true,
        eventType: input.eventType,
        status: 'ignored',
      };
    }

    await this.prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        scope,
        expiresAt: this.idempotencyExpiry(),
      },
    });

    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        sourcePlatform: input.platform,
        eventType: input.eventType,
        externalEventId,
        payload: input.payload as Prisma.InputJsonObject,
        status: 'queued',
      },
    });

    await this.producer.enqueue({ webhookEventId: webhookEvent.id });

    return {
      id: webhookEvent.id,
      duplicate: false,
      eventType: input.eventType,
      status: 'queued',
    };
  }

  private parsePayload(rawPayload: string): Record<string, unknown> {
    try {
      const payload = JSON.parse(rawPayload) as unknown;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Payload must be a JSON object');
      }
      return payload as Record<string, unknown>;
    } catch (error) {
      throw new BadRequestException('Invalid webhook JSON payload');
    }
  }

  private resolveExternalEventId(payload: Record<string, unknown>): string | null {
    const candidates = [
      payload.id,
      payload.order_id,
      this.getNestedValue(payload, ['data', 'id']),
      payload.admin_graphql_api_id,
    ];
    const value = candidates.find(
      (candidate) => candidate !== null && candidate !== undefined && candidate !== '',
    );

    return value === undefined ? null : String(value);
  }

  private getNestedValue(
    payload: Record<string, unknown>,
    path: string[],
  ): unknown {
    return path.reduce<unknown>((current, key) => {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, payload);
  }

  private buildIdempotencyKey(
    platform: WebhookPlatform,
    eventType: string,
    externalEventId: string | null,
    rawPayload: string,
  ): string {
    const payloadHash = this.payloadHash(rawPayload);
    const stableId = externalEventId ?? payloadHash;

    return this.isUpdateLikeEvent(platform, eventType) && externalEventId
      ? `${platform}:${eventType}:${stableId}:${payloadHash}`
      : `${platform}:${eventType}:${stableId}`;
  }

  private payloadHash(rawPayload: string): string {
    return createHash('sha256').update(rawPayload).digest('hex').slice(0, 32);
  }

  private isUpdateLikeEvent(platform: WebhookPlatform, eventType: string): boolean {
    return (
      (platform === 'pancake' && eventType === 'order_updated') ||
      eventType.endsWith('_updated') ||
      eventType.includes('updated')
    );
  }

  private idempotencyExpiry(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
}
