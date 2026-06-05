import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SapoOrderStatus,
  findPancakeStatusByCode,
  findSapoStatusesByPancakeCode,
  QuantityEffect,
} from './order-status.mapper';
import { OrderInventoryImpactService } from './order-inventory-impact.service';

export type OrderProcessingAction =
  | 'create_sapo_order'
  | 'create_sapo_order_if_missing'
  | 'finalize_sapo_order'
  | 'update_sapo_order'
  | 'prepare_viettelpost_handoff'
  | 'create_sapo_fulfillment'
  | 'ensure_sapo_fulfillment'
  | 'deliver_sapo_order'
  | 'cancel_sapo_delivery_if_exists'
  | 'receive_after_cancellation_if_needed'
  | 'cancel_sapo_order'
  | 'create_shopify_fulfillment'
  | 'upsert_order_mapping'
  | 'ignore';

export interface OrderWebhookProcessingPlan {
  platform: 'pancake' | 'shopify' | string;
  eventType: string;
  externalOrderId: string | null;
  statusCode: number | null;
  statusDescription: string;
  quantityEffect: QuantityEffect;
  sapoStatuses: SapoOrderStatus[];
  nextActions: OrderProcessingAction[];
}

interface WebhookEventLike {
  sourcePlatform: string;
  eventType: string;
  externalEventId?: string | null;
  payload: unknown;
}

@Injectable()
export class OrderWebhookProcessingService {
  constructor(
    private readonly inventoryImpactService: OrderInventoryImpactService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  buildProcessingPlan(event: WebhookEventLike): OrderWebhookProcessingPlan {
    if (event.sourcePlatform === 'pancake') {
      return this.buildPancakePlan(event);
    }

    if (event.sourcePlatform === 'shopify') {
      return this.buildShopifyPlan(event);
    }

    return this.ignoredPlan(event, null);
  }

  private buildPancakePlan(event: WebhookEventLike): OrderWebhookProcessingPlan {
    if (!['order_created', 'order_updated'].includes(event.eventType)) {
      return this.ignoredPlan(event, this.resolveExternalOrderId(event));
    }

    const payload = this.objectPayload(event.payload);
    if (!this.matchesPancakeTestOrderFilter(payload)) {
      return this.ignoredPlan(
        event,
        this.resolveExternalOrderId(event),
        'PANCAKE_TEST_FILTER_IGNORED',
      );
    }

    const statusCode = this.numberOrNull(payload.status);
    const pancakeStatus =
      statusCode === null ? null : findPancakeStatusByCode(statusCode);
    const inventoryImpact =
      statusCode === null
        ? null
        : this.inventoryImpactService.resolvePancakeImpact(statusCode);
    const sapoStatuses =
      statusCode === null ? [] : (findSapoStatusesByPancakeCode(statusCode) ?? []);
    const nextActions =
      event.eventType === 'order_created'
        ? this.pancakeCreatedActions()
        : this.pancakeUpdatedActions(statusCode);

    return {
      platform: 'pancake',
      eventType: event.eventType,
      externalOrderId: this.resolveExternalOrderId(event),
      statusCode,
      statusDescription: pancakeStatus?.description ?? 'UNKNOWN',
      quantityEffect:
        statusCode === null ? 'none' : inventoryImpact?.quantityEffect ?? 'none',
      sapoStatuses,
      nextActions,
    };
  }

  private buildShopifyPlan(event: WebhookEventLike): OrderWebhookProcessingPlan {
    if (event.eventType === 'product') {
      return this.ignoredPlan(
        event,
        this.resolveExternalOrderId(event),
        'SHOPIFY_PRODUCT_WEBHOOK_IGNORED_PRODUCT_SYNC_IS_SCHEDULED',
      );
    }

    if (event.eventType === 'fulfillment') {
      return this.ignoredPlan(
        event,
        this.resolveExternalOrderId(event),
        'SHOPIFY_FULFILLMENT_WEBHOOK_IGNORED_NOT_SUPPORTED_YET',
      );
    }

    if (event.eventType !== 'order') {
      return this.ignoredPlan(event, this.resolveExternalOrderId(event));
    }

    return {
      platform: 'shopify',
      eventType: event.eventType,
      externalOrderId: this.resolveExternalOrderId(event),
      statusCode: null,
      statusDescription: 'ORDER_WEBHOOK',
      quantityEffect: 'none',
      sapoStatuses: [],
      nextActions: [
        'create_sapo_order_if_missing',
        'finalize_sapo_order',
        'update_sapo_order',
        'create_sapo_fulfillment',
        'create_shopify_fulfillment',
        'upsert_order_mapping',
      ],
    };
  }

  private pancakeCreatedActions(): OrderProcessingAction[] {
    return ['create_sapo_order', 'finalize_sapo_order', 'upsert_order_mapping'];
  }

  private pancakeUpdatedActions(statusCode: number | null): OrderProcessingAction[] {
    switch (statusCode) {
      case 1:
        return ['update_sapo_order', 'prepare_viettelpost_handoff', 'upsert_order_mapping'];
      case 8:
        return ['create_sapo_fulfillment', 'upsert_order_mapping'];
      case 2:
        return ['ensure_sapo_fulfillment', 'deliver_sapo_order', 'upsert_order_mapping'];
      case 6:
        return [
          'cancel_sapo_delivery_if_exists',
          'receive_after_cancellation_if_needed',
          'cancel_sapo_order',
          'upsert_order_mapping',
        ];
      case 0:
      case 3:
      case 4:
      case 5:
      case 7:
      case 9:
      case 11:
      case 16:
        return ['upsert_order_mapping'];
      default:
        return ['ignore'];
    }
  }

  private ignoredPlan(
    event: WebhookEventLike,
    externalOrderId: string | null,
    statusDescription = 'IGNORED',
  ): OrderWebhookProcessingPlan {
    return {
      platform: event.sourcePlatform,
      eventType: event.eventType,
      externalOrderId,
      statusCode: null,
      statusDescription,
      quantityEffect: 'none',
      sapoStatuses: [],
      nextActions: ['ignore'],
    };
  }

  private resolveExternalOrderId(event: WebhookEventLike): string | null {
    if (event.externalEventId) {
      return event.externalEventId;
    }

    const payload = this.objectPayload(event.payload);
    const value = payload.id ?? payload.order_id ?? payload.admin_graphql_api_id;
    return value === null || value === undefined || value === ''
      ? null
      : String(value);
  }

  private objectPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return payload as Record<string, unknown>;
  }

  private numberOrNull(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private matchesPancakeTestOrderFilter(payload: Record<string, unknown>): boolean {
    const filter = this.configService?.get<string>('pancake.testOrderFilter')?.trim();
    if (!filter) {
      return true;
    }

    const searchableValues = [
      payload.note,
      payload.note_print,
      payload.notePrint,
      ...this.arrayPayload(payload.tags),
    ]
      .map((value) => this.searchableString(value))
      .filter((value) => value.length > 0);

    return searchableValues.some((value) => value.includes(filter));
  }

  private arrayPayload(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private searchableString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return '';
    }

    const objectValue = value as Record<string, unknown>;
    return [objectValue.name, objectValue.value, objectValue.text]
      .filter((entry): entry is string => typeof entry === 'string')
      .join(' ');
  }
}
