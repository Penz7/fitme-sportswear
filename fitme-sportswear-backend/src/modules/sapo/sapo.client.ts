import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SapoSessionService } from './sapo-session.service';

export interface SapoProductResponse {
  id: string;
  name: string;
  updatedAt?: string | null;
  updated_at?: string | null;
  modifiedOn?: string | null;
  modified_on?: string | null;
  variants: Array<{
    id: string;
    sku: string;
    variantRetailPrice: number;
    updatedAt?: string | null;
    updated_at?: string | null;
    modifiedOn?: string | null;
    modified_on?: string | null;
    inventories: Array<{
      available: number;
      onHand: number;
    }>;
  }>;
}

export interface SapoOrderResponse {
  order?: Record<string, any>;
}

export interface SapoOrderListInput {
  page: number;
  limit: number;
  status?: string;
  createdOnMin?: string;
  createdOnMax?: string;
  query?: string;
}

export interface SapoOrderListResponse {
  orders: Record<string, any>[];
  metadata?: {
    total?: number;
  };
}

export interface SapoLogEvent {
  id: number;
  uri?: string | null;
  root_id?: number | string | null;
  rootId?: number | string | null;
}

export interface SapoLogResponse {
  ids: number[];
  logs: SapoLogEvent[];
}

export type SapoOrderPayload = Record<string, any>;
export type SapoFulfillmentPayload = Record<string, any>;

export interface SapoRequestOptions {
  locationId?: string | number;
  tolerateIdempotent422?: boolean;
}

export interface SapoFreightAmountInput {
  senderProvinceId: number;
  senderDistrictId: number;
  receiverProvinceId: number;
  receiverDistrictId: number;
  codAmount: number;
  freightPayer: string;
}

export interface SapoAddressUnit {
  id: number;
  name: string;
}

export interface SapoCustomerResponse {
  customers?: Array<Record<string, any>>;
  customer?: Record<string, any>;
}

@Injectable()
export class SapoClient {
  private readonly pageLimit = 50;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SapoSessionService,
  ) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('sapo.baseUrl');
  }

  async fetchProducts(): Promise<SapoProductResponse[]> {
    const products: SapoProductResponse[] = [];
    let page = 1;

    while (true) {
      const response = await this.sessionService.fetchWithSession(
        this.buildProductsUrl(page),
      );

      if (!response.ok) {
        throw new Error(
          `Sapo product fetch failed with status ${response.status}`,
        );
      }

      const body = (await response.json()) as {
        products?: SapoProductResponse[];
        metadata?: { total?: number };
      };
      const pageProducts = body.products ?? [];

      if (pageProducts.length === 0) {
        break;
      }

      products.push(...pageProducts);

      if (body.metadata?.total !== undefined && products.length >= body.metadata.total) {
        break;
      }

      page += 1;
    }

    return products;
  }

  async fetchOrder(orderId: string): Promise<SapoOrderResponse> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}.json`,
      'GET',
      undefined,
      'Sapo order fetch',
    );
  }

  async fetchOrders(input: SapoOrderListInput): Promise<SapoOrderListResponse> {
    const response = await this.sessionService.fetchWithSession(
      this.buildOrdersUrl(input),
    );

    if (!response.ok) {
      throw new Error(`Sapo orders fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as SapoOrderListResponse;
    return {
      orders: body.orders ?? [],
      metadata: body.metadata,
    };
  }

  async findOrderByCode(code: string): Promise<Record<string, any> | null> {
    const response = await this.fetchOrders({ page: 1, limit: 20, query: code });
    return (
      response.orders.find((order) => String(order.code ?? '').trim() === code) ?? null
    );
  }

  async fetchLogs(page: number, limit: number): Promise<SapoLogResponse> {
    const response = await this.sessionService.fetchWithSession(
      this.buildLogsUrl(page, limit),
    );

    if (!response.ok) {
      throw new Error(`Sapo logs fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as Partial<SapoLogResponse>;
    return {
      ids: body.ids ?? [],
      logs: body.logs ?? [],
    };
  }

  async createOrder(
    orderData: SapoOrderPayload,
    options: SapoRequestOptions = {},
  ): Promise<SapoOrderResponse> {
    return this.request(
      '/admin/orders.json',
      'POST',
      orderData,
      'Sapo order create',
      options,
    );
  }

  async fetchCustomers(
    page: number,
    limit: number,
    query: string,
  ): Promise<SapoCustomerResponse> {
    const url = new URL('/admin/customers.json', `${this.getBaseUrl().replace(/\/$/, '')}/`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('query', query);

    const response = await this.sessionService.fetchWithSession(url.toString());

    if (!response.ok) {
      throw new Error(`Sapo customers fetch failed with status ${response.status}`);
    }

    return (await response.json()) as SapoCustomerResponse;
  }

  async createCustomer(customerData: Record<string, any>): Promise<SapoCustomerResponse> {
    return this.request(
      '/admin/customers.json',
      'POST',
      customerData,
      'Sapo customer create',
    );
  }

  async updateOrder(
    orderId: string,
    orderData: SapoOrderPayload,
    options: SapoRequestOptions = {},
  ): Promise<SapoOrderResponse> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}.json`,
      'PUT',
      orderData,
      'Sapo order update',
      options,
    );
  }

  async finalizeOrder(
    orderId: string,
    options: SapoRequestOptions = {},
  ): Promise<SapoOrderResponse> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/finalize.json`,
      'POST',
      '{}',
      'Sapo order finalize',
      options,
    );
  }

  async prepayOrder(
    orderId: string,
    prepaymentData: Record<string, any>,
    options: SapoRequestOptions = {},
  ): Promise<Record<string, any>> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/prepayments.json`,
      'POST',
      prepaymentData,
      'Sapo order prepayment',
      options,
    );
  }

  async createFulfillment(
    orderId: string,
    fulfillmentData: SapoFulfillmentPayload,
    options: SapoRequestOptions = {},
  ): Promise<Record<string, any>> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/fulfillments.json`,
      'POST',
      fulfillmentData,
      'Sapo fulfillment create',
      options,
    );
  }

  async shipFulfillment(
    orderId: string,
    fulfillmentId: string,
    options: SapoRequestOptions = {},
  ): Promise<Record<string, any>> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(
        fulfillmentId,
      )}/ship.json`,
      'POST',
      '{}',
      'Sapo fulfillment ship',
      options,
    );
  }

  async cancelFulfillment(
    orderId: string,
    fulfillmentId: string,
    fulfillmentData?: SapoFulfillmentPayload,
    options: SapoRequestOptions = {},
  ): Promise<Record<string, any>> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(
        fulfillmentId,
      )}/cancel.json`,
      'POST',
      fulfillmentData ?? '{}',
      'Sapo fulfillment cancel',
      options,
    );
  }

  async receiveAfterCancellation(
    orderId: string,
    fulfillmentId: string,
    fulfillmentData?: SapoFulfillmentPayload,
    options: SapoRequestOptions = {},
  ): Promise<Record<string, any>> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(
        fulfillmentId,
      )}/receive_after_cancellation.json`,
      'POST',
      fulfillmentData ?? '{}',
      'Sapo fulfillment receive after cancellation',
      options,
    );
  }

  async cancelOrder(
    orderId: string,
    options: SapoRequestOptions = {},
  ): Promise<Record<string, any>> {
    return this.request(
      `/admin/orders/${encodeURIComponent(orderId)}/cancel.json`,
      'POST',
      '0',
      'Sapo order cancel',
      options,
    );
  }

  async getFreightAmount(input: SapoFreightAmountInput): Promise<number | null> {
    const response = await this.sessionService.fetchWithSession(
      this.buildFreightAmountUrl(input),
      {
        method: 'GET',
        headers: this.sapoJsonHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Sapo freight amount fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      vtp_price?: { money_total?: number | string | null };
    };
    const parsed = Number(body.vtp_price?.money_total);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async fetchCities(): Promise<SapoAddressUnit[]> {
    const response = await this.sessionService.fetchWithSession(
      this.apiUrl('/admin/cities.json'),
    );

    if (!response.ok) {
      throw new Error(`Sapo cities fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as { cities?: SapoAddressUnit[] };
    return body.cities ?? [];
  }

  async fetchDistrictsByCityId(cityId: number): Promise<SapoAddressUnit[]> {
    const response = await this.sessionService.fetchWithSession(
      this.apiUrl(`/admin/countries/201/cities/${cityId}/districts.json`),
    );

    if (!response.ok) {
      throw new Error(`Sapo districts fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as { districts?: SapoAddressUnit[] };
    return body.districts ?? [];
  }

  async fetchWardsByDistrictId(districtId: number): Promise<SapoAddressUnit[]> {
    const response = await this.sessionService.fetchWithSession(
      this.apiUrl(`/admin/districts/${districtId}/wards.json`),
    );

    if (!response.ok) {
      throw new Error(`Sapo wards fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as { wards?: SapoAddressUnit[] };
    return body.wards ?? [];
  }

  private buildProductsUrl(page: number): string {
    const url = new URL(
      '/admin/products/search.json',
      `${this.getBaseUrl().replace(/\/$/, '')}/`,
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(this.pageLimit));
    return url.toString();
  }

  private buildOrdersUrl(input: SapoOrderListInput): string {
    const url = new URL(
      '/admin/orders.json',
      `${this.getBaseUrl().replace(/\/$/, '')}/`,
    );
    url.searchParams.set('page', String(input.page));
    url.searchParams.set('limit', String(input.limit));
    if (input.status) {
      url.searchParams.set('status', input.status);
    }
    if (input.createdOnMin) {
      url.searchParams.set('created_on_min', input.createdOnMin);
    }
    if (input.createdOnMax) {
      url.searchParams.set('created_on_max', input.createdOnMax);
    }
    if (input.query) {
      url.searchParams.set('query', input.query);
    }
    return url.toString();
  }

  private buildLogsUrl(page: number, limit: number): string {
    const url = new URL(
      '/admin/logs.json',
      `${this.getBaseUrl().replace(/\/$/, '')}/`,
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(limit));
    return url.toString();
  }

  private buildFreightAmountUrl(input: SapoFreightAmountInput): string {
    const url = new URL(
      '/admin/shipping_services/v3/vtp/price.json',
      `${this.getBaseUrl().replace(/\/$/, '')}/`,
    );
    url.searchParams.set('sender_province_id', String(input.senderProvinceId));
    url.searchParams.set('sender_district_id', String(input.senderDistrictId));
    url.searchParams.set('receiver_province_id', String(input.receiverProvinceId));
    url.searchParams.set('receiver_district_id', String(input.receiverDistrictId));
    url.searchParams.set('package_type', 'HH');
    url.searchParams.set('package_height', String(this.configNumber('shipping.package.height', 10)));
    url.searchParams.set('package_width', String(this.configNumber('shipping.package.width', 10)));
    url.searchParams.set('package_length', String(this.configNumber('shipping.package.length', 10)));
    url.searchParams.set('package_value', '0');
    url.searchParams.set('cod_amount', String(input.codAmount));
    url.searchParams.set('service_extra', '');
    url.searchParams.set('service', this.configString('shipping.viettelPost.service', 'VSL7'));
    url.searchParams.set('package_weight', String(this.configNumber('shipping.package.weight', 300)));
    url.searchParams.set('receiver_province_name', '');
    url.searchParams.set('receiver_district_name', '');
    url.searchParams.set('receiver_ward_name', '');
    url.searchParams.set('freight_payer', input.freightPayer);
    url.searchParams.set('shipping_account_id', this.configString('shipping.viettelPost.accountId', '604003_1'));
    return url.toString();
  }

  private async request<T>(
    path: string,
    method: string,
    body: unknown,
    label: string,
    options: SapoRequestOptions = {},
  ): Promise<T> {
    const response = await this.sessionService.fetchWithSession(this.apiUrl(path), {
      method,
      headers: this.sapoJsonHeaders(options.locationId),
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      if (
        response.status === 422 &&
        options.tolerateIdempotent422 &&
        this.isIdempotentSapoError(responseText)
      ) {
        return {} as T;
      }

      const responseSummary =
        responseText.length > 1000
          ? `${responseText.slice(0, 1000)}...`
          : responseText;
      throw new Error(
        `${label} failed with status ${response.status}: ${responseSummary}`,
      );
    }

    return (await response.json()) as T;
  }

  private isIdempotentSapoError(body: string): boolean {
    const normalized = body.toLowerCase();
    return (
      normalized.includes('already') ||
      normalized.includes('not_suitable') ||
      normalized.includes('not suitable') ||
      normalized.includes('status.not_suitable') ||
      normalized.includes('cancelled') ||
      normalized.includes('canceled') ||
      normalized.includes('finalized') ||
      normalized.includes('fulfilled') ||
      normalized.includes('shipped')
    );
  }

  private apiUrl(path: string): string {
    return new URL(
      path.replace(/^\//, ''),
      `${this.getBaseUrl().replace(/\/$/, '')}/`,
    ).toString();
  }

  private sapoJsonHeaders(locationId?: string | number): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Sapo-LocationId': String(
        locationId ?? this.configString('sapo.locationId', '572310'),
      ),
    };
  }

  private configString(key: string, fallback: string): string {
    const value = this.configService.get<string | number | undefined>(key);
    return value === null || value === undefined || String(value).trim() === ''
      ? fallback
      : String(value);
  }

  private configNumber(key: string, fallback: number): number {
    const parsed = Number(this.configService.get<number | string | undefined>(key));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
