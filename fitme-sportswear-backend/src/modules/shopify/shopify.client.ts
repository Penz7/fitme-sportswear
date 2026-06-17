import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ShopifyProductResponse {
  id: string;
  title: string;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    available: number;
    inventoryQuantity: number;
    price: number;
  }>;
}

export interface ShopifyInventoryUpdateInput {
  variantId: string;
  available: number;
  retailPrice: number | null;
}

export interface ShopifyProductCreateInput {
  sku: string;
  name: string | null;
  available: number;
  retailPrice: number | null;
}

export interface ShopifyProductCreateResult {
  productId: string;
  variantId: string;
}

export interface ShopifyFulfillmentInput {
  orderId: string;
  trackingCompany: string;
  trackingNumber: string;
  notifyCustomer: boolean;
  lineItems: Array<{ id: string | number; quantity: number }>;
}

export interface ShopifyWebhookInput {
  topic: string;
  address: string;
  format: 'json' | 'xml';
}

export interface ShopifyWebhookResponse {
  id: string | number;
  topic: string;
  address: string;
  format: string;
}

export type ShopifyWebhookEnsureAction = 'created' | 'updated' | 'unchanged';

interface ShopifyProductsPage {
  products?: ShopifyProductResponse[];
}

interface ShopifyVariantResponse {
  variant: {
    id: string;
    inventory_item_id: string;
    inventory_management: string | null;
    price: string;
  };
}

interface ShopifyLocationsResponse {
  locations?: Array<{ id: string | number }>;
}

interface ShopifyWebhooksResponse {
  webhooks?: ShopifyWebhookResponse[];
}

interface ShopifyFulfillmentOrdersResponse {
  fulfillment_orders?: Array<{
    id: string | number;
    status?: string;
    request_status?: string;
    assigned_location_id?: string | number | null;
    line_items?: Array<{
      id: string | number;
      line_item_id?: string | number | null;
      quantity?: number;
      fulfillable_quantity?: number;
    }>;
  }>;
}

@Injectable()
export class ShopifyClient {
  private cachedLocationId: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('shopify.baseUrl');
  }

  async fetchProducts(): Promise<ShopifyProductResponse[]> {
    const products: ShopifyProductResponse[] = [];
    let url: string | null = this.buildProductsUrl();

    while (url) {
      const response = await fetch(url, { headers: this.authHeaders() });

      if (!response.ok) {
        throw new Error(
          `Shopify product fetch failed with status ${response.status}`,
        );
      }

      const body = (await response.json()) as ShopifyProductsPage;
      products.push(...(body.products ?? []));
      url = this.extractNextLink(response.headers.get('link'));
    }

    return products;
  }

  async updateInventoryAndPrice(
    input: ShopifyInventoryUpdateInput,
  ): Promise<void> {
    const variant = await this.fetchVariant(input.variantId);

    if (variant.inventory_management !== 'shopify') {
      await this.updateVariant(variant, { inventoryManagement: 'shopify' });
    }

    if (
      input.retailPrice !== null &&
      !this.samePrice(variant.price, input.retailPrice)
    ) {
      await this.updateVariant(variant, { price: input.retailPrice });
    }

    const locationId = await this.getLocationId();
    const response = await fetch(this.apiUrl('/inventory_levels/set.json'), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        inventory_item_id: variant.inventory_item_id,
        location_id: locationId,
        available: input.available,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify inventory level update failed with status ${response.status}`,
      );
    }
  }

  async createFulfillment(input: ShopifyFulfillmentInput): Promise<void> {
    const fulfillmentOrders = await this.fetchFulfillmentOrders(input.orderId);
    const openFulfillmentOrders = fulfillmentOrders.filter((fulfillmentOrder) =>
      this.isFulfillableOrder(fulfillmentOrder),
    );

    if (openFulfillmentOrders.length === 0 && fulfillmentOrders.length > 0) {
      return;
    }

    const lineItemsByFulfillmentOrder = openFulfillmentOrders.map((fulfillmentOrder) => ({
      fulfillment_order_id: fulfillmentOrder.id,
      fulfillment_order_line_items: this.fulfillmentOrderLineItems(
        fulfillmentOrder,
        input.lineItems,
      ),
    }));

    if (lineItemsByFulfillmentOrder.length === 0) {
      throw new Error(
        `Shopify fulfillment order is required for order ${input.orderId}`,
      );
    }

    const response = await fetch(this.apiUrl('/fulfillments.json'), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        fulfillment: {
          line_items_by_fulfillment_order: lineItemsByFulfillmentOrder,
          tracking_info: {
            company: input.trackingCompany,
            number: input.trackingNumber,
          },
          notify_customer: input.notifyCustomer,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 422 && this.isFulfillmentAlreadyApplied(await response.text())) {
        return;
      }

      throw new Error(
        `Shopify fulfillment create failed with status ${response.status}`,
      );
    }
  }

  async fetchFulfillmentOrders(
    orderId: string,
  ): Promise<NonNullable<ShopifyFulfillmentOrdersResponse['fulfillment_orders']>> {
    const response = await fetch(
      this.apiUrl(`/orders/${orderId}/fulfillment_orders.json`),
      { headers: this.authHeaders() },
    );

    if (!response.ok) {
      throw new Error(
        `Shopify fulfillment orders fetch failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as ShopifyFulfillmentOrdersResponse;
    return body.fulfillment_orders ?? [];
  }

  async createProductFromSapo(
    input: ShopifyProductCreateInput,
  ): Promise<ShopifyProductCreateResult> {
    const response = await fetch(this.apiUrl('/products.json'), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        product: {
          title: input.name ?? input.sku,
          variants: [
            {
              sku: input.sku,
              price: input.retailPrice,
              inventory_management: 'shopify',
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify product create failed with status ${response.status}`);
    }

    const body = (await response.json()) as Record<string, any>;
    const product = this.objectPayload(body.product);
    const variant = this.arrayPayload(product.variants)[0];

    return {
      productId: String(product.id),
      variantId: String(variant.id),
    };
  }

  async fetchProduct(productId: string): Promise<Record<string, any> | null> {
    const response = await fetch(this.apiUrl(`/products/${productId}.json`), {
      headers: this.authHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Shopify product fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as Record<string, any>;
    return this.objectPayload(body.product);
  }

  async fetchOrder(orderId: string): Promise<Record<string, any> | null> {
    const response = await fetch(this.apiUrl(`/orders/${orderId}.json`), {
      headers: this.authHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Shopify order fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as Record<string, any>;
    return this.objectPayload(body.order);
  }

  async deleteProduct(productId: string): Promise<void> {
    const response = await fetch(this.apiUrl(`/products/${productId}.json`), {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Shopify product delete failed with status ${response.status}`);
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    const response = await fetch(this.apiUrl(`/orders/${orderId}/cancel.json`), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 422 && this.isIdempotentOrderState(body)) {
        return;
      }
      throw new Error(
        `Shopify order cancel failed with status ${response.status}`,
      );
    }
  }

  async closeOrder(orderId: string): Promise<void> {
    const response = await fetch(this.apiUrl(`/orders/${orderId}/close.json`), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 422 && this.isIdempotentOrderState(body)) {
        return;
      }
      throw new Error(`Shopify order close failed with status ${response.status}`);
    }
  }

  async fetchWebhooks(): Promise<ShopifyWebhookResponse[]> {
    const response = await fetch(this.apiUrl('/webhooks.json?limit=250'), {
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Shopify webhook fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as ShopifyWebhooksResponse;
    return body.webhooks ?? [];
  }

  async createWebhook(input: ShopifyWebhookInput): Promise<void> {
    const response = await fetch(this.apiUrl('/webhooks.json'), {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ webhook: input }),
    });

    if (!response.ok) {
      throw new Error(`Shopify webhook create failed with status ${response.status}`);
    }
  }

  async updateWebhook(
    webhookId: string | number,
    input: Pick<ShopifyWebhookInput, 'address' | 'format'>,
  ): Promise<void> {
    const id = String(webhookId);
    const response = await fetch(this.apiUrl(`/webhooks/${id}.json`), {
      method: 'PUT',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        webhook: {
          id,
          ...input,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify webhook update failed with status ${response.status}`);
    }
  }

  async ensureWebhook(input: ShopifyWebhookInput): Promise<ShopifyWebhookEnsureAction> {
    const webhooks = await this.fetchWebhooks();
    const existing = webhooks.find((webhook) => webhook.topic === input.topic);

    if (!existing) {
      await this.createWebhook(input);
      return 'created';
    }

    if (existing.address === input.address && existing.format === input.format) {
      return 'unchanged';
    }

    await this.updateWebhook(existing.id, {
      address: input.address,
      format: input.format,
    });
    return 'updated';
  }

  private buildProductsUrl(): string {
    const url = new URL(this.apiUrl('/products.json'));
    url.searchParams.set('limit', '250');
    url.searchParams.set(
      'fields',
      'id,title,vendor,product_type,status,images,variants',
    );
    return url.toString();
  }

  private extractNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) {
      return null;
    }

    for (const part of linkHeader.split(',')) {
      const [rawUrl, rawRel] = part.split(';').map((value) => value.trim());
      if (rawRel === 'rel="next"') {
        return rawUrl.slice(1, -1);
      }
    }

    return null;
  }

  private async fetchVariant(
    variantId: string,
  ): Promise<ShopifyVariantResponse['variant']> {
    const response = await fetch(this.apiUrl(`/variants/${variantId}.json`), {
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify variant fetch failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as ShopifyVariantResponse;
    return body.variant;
  }

  private async updateVariant(
    variant: ShopifyVariantResponse['variant'],
    input: { inventoryManagement?: string; price?: number },
  ): Promise<void> {
    const response = await fetch(this.apiUrl(`/variants/${variant.id}.json`), {
      method: 'PUT',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        variant: {
          id: variant.id,
          ...(input.inventoryManagement
            ? { inventory_management: input.inventoryManagement }
            : {}),
          ...(input.price !== undefined ? { price: input.price } : {}),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify variant update failed with status ${response.status}`,
      );
    }
  }

  private samePrice(currentPrice: string | number | null, nextPrice: number): boolean {
    const current = Number(currentPrice);
    return Number.isFinite(current) && current === nextPrice;
  }

  private isFulfillableOrder(fulfillmentOrder: {
    status?: string;
    request_status?: string;
  }): boolean {
    const status = String(fulfillmentOrder.status ?? '').toLowerCase();
    const requestStatus = String(fulfillmentOrder.request_status ?? '').toLowerCase();

    return (
      ['open', 'in_progress', 'scheduled'].includes(status) &&
      !['cancellation_requested', 'cancellation_accepted'].includes(requestStatus)
    );
  }

  private fulfillmentOrderLineItems(
    fulfillmentOrder: NonNullable<ShopifyFulfillmentOrdersResponse['fulfillment_orders']>[number],
    orderLineItems: ShopifyFulfillmentInput['lineItems'],
  ): Array<{ id: string | number; quantity: number }> {
    const requestedLineItems = new Map(
      orderLineItems.map((lineItem) => [String(lineItem.id), lineItem.quantity]),
    );

    return (fulfillmentOrder.line_items ?? [])
      .map((lineItem) => {
        const requestedQuantity = requestedLineItems.get(String(lineItem.line_item_id));
        const quantity = Math.min(
          requestedQuantity ?? lineItem.fulfillable_quantity ?? lineItem.quantity ?? 0,
          lineItem.fulfillable_quantity ?? lineItem.quantity ?? requestedQuantity ?? 0,
        );

        return { id: lineItem.id, quantity };
      })
      .filter((lineItem) => lineItem.quantity > 0);
  }

  private isFulfillmentAlreadyApplied(body: string): boolean {
    const normalized = body.toLowerCase();
    return (
      normalized.includes('already') ||
      normalized.includes('closed') ||
      normalized.includes('not fulfillable') ||
      normalized.includes('fulfilled')
    );
  }

  private isIdempotentOrderState(body: string): boolean {
    const normalized = body.toLowerCase();
    return (
      normalized.includes('already') ||
      normalized.includes('cancelled') ||
      normalized.includes('canceled') ||
      normalized.includes('closed') ||
      normalized.includes('not open')
    );
  }

  private async getLocationId(): Promise<string> {
    const configuredLocationId =
      this.configService.get<string>('shopify.locationId');
    if (configuredLocationId) {
      return configuredLocationId;
    }

    if (this.cachedLocationId) {
      return this.cachedLocationId;
    }

    const response = await fetch(this.apiUrl('/locations.json'), {
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify locations fetch failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as ShopifyLocationsResponse;
    const firstLocation = body.locations?.[0]?.id;

    if (!firstLocation) {
      throw new Error('Shopify location is required for inventory update');
    }

    this.cachedLocationId = String(firstLocation);
    return this.cachedLocationId;
  }

  private apiUrl(path: string): string {
    return new URL(
      path.replace(/^\//, ''),
      `${this.getBaseUrl().replace(/\/$/, '')}/`,
    ).toString();
  }

  private authHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.requiredConfig('shopify.accessToken'),
    };
  }

  private jsonHeaders(): Record<string, string> {
    return {
      ...this.authHeaders(),
      'Content-Type': 'application/json',
    };
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required Shopify config: ${key}`);
    }

    return value;
  }

  private objectPayload(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private arrayPayload(value: unknown): Record<string, any>[] {
    return Array.isArray(value) ? (value as Record<string, any>[]) : [];
  }
}
