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
      await this.enableShopifyInventoryManagement(variant);
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
    const locationId = await this.getLocationId();
    const response = await fetch(
      this.apiUrl(`/orders/${input.orderId}/fulfillments.json`),
      {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify({
          fulfillment: {
            location_id: locationId,
            tracking_company: input.trackingCompany,
            tracking_number: input.trackingNumber,
            notify_customer: input.notifyCustomer,
            line_items: input.lineItems,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Shopify fulfillment create failed with status ${response.status}`,
      );
    }
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
      throw new Error(
        `Shopify order cancel failed with status ${response.status}`,
      );
    }
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

  private async enableShopifyInventoryManagement(
    variant: ShopifyVariantResponse['variant'],
  ): Promise<void> {
    const response = await fetch(this.apiUrl(`/variants/${variant.id}.json`), {
      method: 'PUT',
      headers: this.jsonHeaders(),
      body: JSON.stringify({
        variant: {
          id: variant.id,
          inventory_management: 'shopify',
          price: variant.price,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify variant update failed with status ${response.status}`,
      );
    }
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
