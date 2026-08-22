import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PancakeProductResponse {
  displayId?: string;
  display_id?: string;
  customId?: string;
  custom_id?: string;
  barcode?: string;
  productId?: string;
  product_id?: string;
  id: string;
  product: {
    name: string;
  };
  retailPrice?: number;
  retail_price?: number;
  variationsWarehouses?: Array<{
    warehouseId?: string;
    warehouse_id?: string;
    remainQuantity?: number;
    remain_quantity?: number;
    actualRemainQuantity?: number;
    actual_remain_quantity?: number;
  }>;
  variations_warehouses?: Array<{
    warehouseId?: string;
    warehouse_id?: string;
    remainQuantity?: number;
    remain_quantity?: number;
    actualRemainQuantity?: number;
    actual_remain_quantity?: number;
  }>;
}

export interface PancakeInventoryUpdateInput {
  variantId: string;
  warehouseId: string | null;
  available: number;
}

export interface ReceivingProductCreateInput {
  sku: string;
  name: string | null;
  available: number;
  retailPrice: number | null;
}

export interface PancakeProductCreateResult {
  productId: string;
  variantId: string;
  warehouseId: string | null;
}

export interface PancakeCompositeProductUpdateInput {
  comboVariantId: string;
  components: Array<{
    variationId: string;
    quantity: number;
  }>;
}

export interface PancakeAddressUnit {
  id: number;
  name: string;
}

export type PancakeOrderPayload = Record<string, any>;
export type PancakeOrderResponse = Record<string, any>;

export interface PancakeOrderListInput {
  pageSize: number;
  pageNumber: number;
}

interface PancakeVariationsPage {
  data?: PancakeProductResponse[];
  total_pages?: number;
  totalPages?: number;
}

@Injectable()
export class PancakeClient {
  private readonly pageSize = 1000;

  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('pancake.baseUrl');
  }

  async fetchProducts(): Promise<PancakeProductResponse[]> {
    const products: PancakeProductResponse[] = [];
    const maxPages = this.configNumber('pancake.productFetchMaxPages', 50);

    for (let pageNumber = 1; ; pageNumber += 1) {
      if (pageNumber > maxPages) {
        throw new Error(
          `Pancake product fetch exceeded max pages (${maxPages})`,
        );
      }

      const url = new URL(
        `/api/v1/shops/${this.requiredConfig('pancake.shopId')}/products/variations`,
        this.normalizedBaseUrl(),
      );
      url.searchParams.set('page_size', String(this.pageSize));
      url.searchParams.set('page_number', String(pageNumber));
      url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));

      let response: Response;
      try {
        response = await this.fetchProductRequest(url.toString());
      } catch (error) {
        throw new Error(
          `Pancake product fetch failed on page ${pageNumber}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      if (!response.ok) {
        throw new Error(
          `Pancake product fetch failed with status ${response.status} on page ${pageNumber}`,
        );
      }

      const body = (await response.json()) as PancakeVariationsPage;
      const pageProducts = body.data ?? [];

      if (pageProducts.length === 0) {
        break;
      }

      products.push(...pageProducts);

      const totalPages = body.total_pages ?? body.totalPages;
      if (totalPages !== undefined && pageNumber >= totalPages) {
        break;
      }
    }

    return products;
  }

  async fetchProductsBySku(sku: string): Promise<PancakeProductResponse[]> {
    const url = new URL(
      `/api/v1/shops/${this.requiredConfig('pancake.shopId')}/products/variations`,
      this.normalizedBaseUrl(),
    );
    url.searchParams.set('page_size', '100');
    url.searchParams.set('page_number', '1');
    url.searchParams.set('search', sku);
    url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));

    const response = await this.fetchProductRequest(url.toString());
    if (!response.ok) {
      throw new Error(
        `Pancake product search failed with status ${response.status}`,
      );
    }

    const body = (await response.json()) as PancakeVariationsPage;
    return body.data ?? [];
  }

  async updateInventory(input: PancakeInventoryUpdateInput): Promise<void> {
    if (!input.warehouseId) {
      throw new Error('Pancake warehouseId is required for inventory update');
    }

    const url = new URL(
      `/api/v1/shops/${this.requiredConfig('pancake.shopId')}/variations/${input.variantId}/update_quantity`,
      this.normalizedBaseUrl(),
    );
    url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));

    const response = await this.fetchProductRequest(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variations_warehouses: [
          {
            warehouse_id: input.warehouseId,
            remain_quantity: input.available,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Pancake inventory update failed with status ${response.status}`,
      );
    }
  }

  async createProductFromSapo(
    input: ReceivingProductCreateInput,
  ): Promise<PancakeProductCreateResult> {
    const url = this.shopUrl('/products');
    this.addApiKey(url);

    const response = await this.fetchProductRequest(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: {
          name: input.name ?? input.sku,
          custom_id: input.sku,
          variations: [
            {
              custom_id: input.sku,
              is_edit_custom_id: true,
              barcode: input.sku,
              retail_price: input.retailPrice,
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Pancake product create failed with status ${response.status}`);
    }

    const body = (await response.json()) as Record<string, any>;
    const data = this.objectPayload(body.data);
    const variation = this.arrayPayload(data.variations)[0] ?? data;
    const warehouse = this.arrayPayload(
      variation.variations_warehouses ?? variation.variationsWarehouses,
    )[0];

    return {
      productId: String(variation.product_id ?? variation.productId ?? data.id),
      variantId: String(variation.id),
      warehouseId:
        warehouse?.warehouse_id === undefined && warehouse?.warehouseId === undefined
          ? null
          : String(warehouse.warehouse_id ?? warehouse.warehouseId),
    };
  }

  async updateCompositeProduct(
    input: PancakeCompositeProductUpdateInput,
  ): Promise<void> {
    const url = this.shopUrl('/variations/update_composite_product');
    this.addApiKey(url);

    const response = await this.fetchProductRequest(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variation_id: input.comboVariantId,
        composite_products: input.components.map((component) => ({
          variation_id: component.variationId,
          quantity: component.quantity,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Pancake composite product update failed with status ${response.status}`,
      );
    }
  }

  async fetchProvinces(): Promise<PancakeAddressUnit[]> {
    return this.fetchAddressUnits('/geo/provinces');
  }

  async fetchDistrictsByProvinceId(provinceId: number): Promise<PancakeAddressUnit[]> {
    return this.fetchAddressUnits('/geo/districts', {
      province_id: String(provinceId),
    });
  }

  async fetchCommunesByDistrictId(districtId: number): Promise<PancakeAddressUnit[]> {
    return this.fetchAddressUnits('/geo/communes', {
      district_id: String(districtId),
    });
  }

  async fetchOrders(input: PancakeOrderListInput): Promise<PancakeOrderResponse> {
    const url = this.shopUrl('/orders');
    url.searchParams.set('page_size', String(input.pageSize));
    url.searchParams.set('page_number', String(input.pageNumber));
    this.addApiKey(url);

    return this.fetchOrderResponse(url.toString(), undefined, 'Pancake orders fetch');
  }

  async fetchOrder(orderId: string): Promise<PancakeOrderResponse> {
    const url = this.shopUrl(`/orders/${orderId}`);
    this.addApiKey(url);

    return this.fetchOrderResponse(url.toString(), undefined, 'Pancake order fetch');
  }

  async createOrder(order: PancakeOrderPayload): Promise<PancakeOrderResponse> {
    const url = this.shopUrl('/orders');
    this.addApiKey(url);

    return this.fetchOrderResponse(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      },
      'Pancake order create',
    );
  }

  async updateOrder(
    orderId: string,
    order: PancakeOrderPayload,
  ): Promise<PancakeOrderResponse> {
    const url = this.shopUrl(`/orders/${orderId}`);
    this.addApiKey(url);

    return this.fetchOrderResponse(
      url.toString(),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      },
      'Pancake order update',
    );
  }

  private normalizedBaseUrl(): string {
    const baseUrl = this.getBaseUrl().replace(/\/$/, '');
    return baseUrl.endsWith('/api/v1')
      ? baseUrl.slice(0, -'/api/v1'.length)
      : baseUrl;
  }

  private async fetchAddressUnits(
    path: string,
    params: Record<string, string> = {},
  ): Promise<PancakeAddressUnit[]> {
    const url = new URL(path.replace(/^\//, ''), `${this.getBaseUrl().replace(/\/$/, '')}/`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Pancake address fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as { data?: Array<Record<string, any>> };
    return (body.data ?? [])
      .map((unit) => ({
        id: Number(unit.id),
        name: String(unit.name ?? ''),
      }))
      .filter((unit) => Number.isFinite(unit.id) && unit.name.length > 0);
  }

  private async fetchOrderResponse(
    url: string,
    init: RequestInit | undefined,
    label: string,
  ): Promise<PancakeOrderResponse> {
    const response = init === undefined ? await fetch(url) : await fetch(url, init);

    if (!response.ok) {
      throw new Error(`${label} failed with status ${response.status}`);
    }

    return (await response.json()) as PancakeOrderResponse;
  }

  private async fetchProductRequest(
    url: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const attempts = this.configNumber('pancake.productRetryAttempts', 3);
    const backoffMs = this.configNumber('pancake.productRetryBackoffMs', 1000);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: this.timeoutSignal('pancake.productRequestTimeoutMs', 15000),
        });

        if (!this.isRetryableProductResponse(response) || attempt === attempts) {
          return response;
        }

        lastError = new Error(`Pancake product request returned status ${response.status}`);
      } catch (error) {
        lastError = error;
        if (attempt === attempts) {
          throw error;
        }
      }

      await this.sleep(backoffMs * attempt);
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private timeoutSignal(key: string, fallbackMs: number): AbortSignal {
    const timeoutMs = this.configNumber(key, fallbackMs);
    return AbortSignal.timeout(timeoutMs);
  }

  private configNumber(key: string, fallback: number): number {
    const configured = Number(this.configService.get<number | string | undefined>(key));
    return Number.isFinite(configured) && configured > 0 ? configured : fallback;
  }

  private isRetryableProductResponse(response: Response): boolean {
    return response.status === 429 || response.status >= 500;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private shopUrl(path: string): URL {
    return new URL(
      `/api/v1/shops/${this.requiredConfig('pancake.shopId')}${path}`,
      this.normalizedBaseUrl(),
    );
  }

  private addApiKey(url: URL): void {
    url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required Pancake config: ${key}`);
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
