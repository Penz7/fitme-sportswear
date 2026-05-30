# Real Product Integration Clients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Sapo, Pancake, and Shopify placeholder product/inventory clients with real API clients that keep the existing product inventory sync flow intact.

**Architecture:** Keep the existing platform modules as integration boundaries. Add `SapoSessionService` for Sapo cookie login and retry support, then implement real HTTP behavior inside `SapoClient`, `PancakeClient`, and `ShopifyClient` using Node built-in `fetch`. Preserve the existing response contracts consumed by `ProductSnapshotService`, mappers, matching, and `InventorySyncService`.

**Tech Stack:** NestJS 10, `@nestjs/config`, Jest, TypeScript, Node built-in `fetch`, existing Prisma-backed product sync services.

---

## File Structure

- Modify `fitme-sportswear-backend/src/modules/config/configuration.ts`
  - Add typed config values for Sapo account login, Pancake API key/shop ID, Shopify token/API version/location ID.
- Modify `fitme-sportswear-backend/src/modules/config/env.validation.ts`
  - Replace product-sync Sapo token requirement with session-login settings.
  - Keep required Pancake/Shopify product sync settings.
  - Make Shopify webhook secret optional for this phase unless another module requires it at runtime.
- Create `fitme-sportswear-backend/src/modules/sapo/sapo-session.service.ts`
  - Own Sapo login flow, in-memory cookies, cookie header, session refresh, and request retry on `401`.
- Create `fitme-sportswear-backend/src/modules/sapo/sapo-session.service.spec.ts`
  - Unit tests for login form, cookie capture, refresh, and login failure.
- Modify `fitme-sportswear-backend/src/modules/sapo/sapo.module.ts`
  - Provide and export `SapoSessionService` beside `SapoClient`.
- Modify `fitme-sportswear-backend/src/modules/sapo/sapo.client.ts`
  - Fetch paginated Sapo product search results through `SapoSessionService`.
- Create `fitme-sportswear-backend/src/modules/sapo/sapo.client.spec.ts`
  - Unit tests for pagination and 401 retry behavior.
- Modify `fitme-sportswear-backend/src/modules/pancake/pancake.client.ts`
  - Fetch paginated Pancake variations and update variation warehouse quantity.
- Create `fitme-sportswear-backend/src/modules/pancake/pancake.client.spec.ts`
  - Unit tests for query params, pagination, and update payload.
- Modify `fitme-sportswear-backend/src/modules/shopify/shopify.client.ts`
  - Fetch products with Shopify token and Link pagination; fetch/cache location; fetch/update variant when needed; set inventory level.
- Create `fitme-sportswear-backend/src/modules/shopify/shopify.client.spec.ts`
  - Unit tests for token header, pagination, location cache, inventory payload, and variant update preservation.
- Optionally modify `fitme-sportswear-backend/src/modules/products/product-snapshot.service.spec.ts`
  - Add one lightweight contract-shape test only if existing tests do not exercise real client-shaped data.

## Implementation Notes

- Do not add an HTTP dependency.
- Mock `global.fetch` in tests; never call real external APIs.
- Use exact existing public method names:
  - `SapoClient.fetchProducts()`
  - `PancakeClient.fetchProducts()`
  - `PancakeClient.updateInventory(input)`
  - `ShopifyClient.fetchProducts()`
  - `ShopifyClient.updateInventoryAndPrice(input)`
- Preserve existing interfaces unless tests prove mapper compatibility needs extra optional fields.
- Throw clear `Error` messages for missing config and non-2xx HTTP responses.
- Do not redesign `ProductSnapshotService`, matching, orchestrator, queue, or `/sync/products` endpoints.

---

### Task 1: Expand platform configuration

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/config/configuration.ts`
- Modify: `fitme-sportswear-backend/src/modules/config/env.validation.ts`

- [ ] **Step 1: Update configuration object**

Replace `configuration.ts` platform sections with this shape while keeping the existing `app` and `redis` sections unchanged:

```ts
export default () => ({
  app: {
    env: process.env.APP_ENV ?? 'local',
    port: Number(process.env.APP_PORT ?? 3000),
    version: process.env.APP_VERSION ?? '0.1.0',
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: Number(process.env.REDIS_PORT),
  },
  sapo: {
    baseUrl: process.env.SAPO_BASE_URL as string,
    accountBaseUrl: process.env.SAPO_ACCOUNT_BASE_URL ?? 'https://accounts.sapo.vn',
    phoneNumber: process.env.SAPO_PHONE_NUMBER as string,
    password: process.env.SAPO_PASSWORD as string,
    clientId: process.env.SAPO_CLIENT_ID as string,
    shopDomain: process.env.SAPO_SHOP_DOMAIN as string,
  },
  pancake: {
    baseUrl: process.env.PANCAKE_BASE_URL as string,
    apiKey: process.env.PANCAKE_API_KEY as string,
    shopId: process.env.PANCAKE_SHOP_ID as string,
  },
  shopify: {
    baseUrl: process.env.SHOPIFY_BASE_URL as string,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN as string,
    apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-04',
    locationId: process.env.SHOPIFY_LOCATION_ID,
  },
});
```

- [ ] **Step 2: Update env validation schema**

Replace the platform-specific part of `env.validation.ts` with this schema while keeping the existing app/database/redis rules:

```ts
export const envValidationSchema = Joi.object({
  APP_ENV: Joi.string().valid('local', 'test', 'development', 'production').default('local'),
  APP_PORT: Joi.number().port().default(3000),
  APP_VERSION: Joi.string().default('0.1.0'),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),

  SAPO_BASE_URL: Joi.string().uri().required(),
  SAPO_ACCOUNT_BASE_URL: Joi.string().uri().default('https://accounts.sapo.vn'),
  SAPO_PHONE_NUMBER: Joi.string().required(),
  SAPO_PASSWORD: Joi.string().required(),
  SAPO_CLIENT_ID: Joi.string().required(),
  SAPO_SHOP_DOMAIN: Joi.string().required(),

  PANCAKE_BASE_URL: Joi.string().uri().required(),
  PANCAKE_API_KEY: Joi.string().required(),
  PANCAKE_SHOP_ID: Joi.string().required(),

  SHOPIFY_BASE_URL: Joi.string().uri().required(),
  SHOPIFY_ACCESS_TOKEN: Joi.string().required(),
  SHOPIFY_API_VERSION: Joi.string().default('2024-04'),
  SHOPIFY_LOCATION_ID: Joi.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: Joi.string().optional(),
});
```

- [ ] **Step 3: Run focused validation check**

Run:

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/products/product-snapshot.service.spec.ts
```

Expected: existing product snapshot tests still pass; config changes should not affect them.

- [ ] **Step 4: Commit**

```bash
git add fitme-sportswear-backend/src/modules/config/configuration.ts fitme-sportswear-backend/src/modules/config/env.validation.ts
git commit -m "config: add real platform client settings"
```

---

### Task 2: Add Sapo session service

**Files:**
- Create: `fitme-sportswear-backend/src/modules/sapo/sapo-session.service.ts`
- Create: `fitme-sportswear-backend/src/modules/sapo/sapo-session.service.spec.ts`
- Modify: `fitme-sportswear-backend/src/modules/sapo/sapo.module.ts`

- [ ] **Step 1: Write failing Sapo session tests**

Create `sapo-session.service.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { SapoSessionService } from './sapo-session.service';

describe('SapoSessionService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createService(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      'sapo.accountBaseUrl': 'https://accounts.sapo.vn',
      'sapo.baseUrl': 'https://fitme-sportswear.mysapogo.com',
      'sapo.phoneNumber': '901234567',
      'sapo.password': 'secret',
      'sapo.clientId': 'sapo-client',
      'sapo.shopDomain': 'fitme-sportswear.mysapogo.com',
      ...overrides,
    };

    const configService = {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    return new SapoSessionService(configService);
  }

  function response(ok: boolean, status: number, setCookie?: string[]) {
    return {
      ok,
      status,
      headers: {
        getSetCookie: () => setCookie ?? [],
        get: (name: string) =>
          name.toLowerCase() === 'set-cookie' ? setCookie?.join(', ') ?? null : null,
      },
      text: async () => 'response body',
    } as unknown as Response;
  }

  it('builds the login form and stores cookies from all Sapo login steps', async () => {
    fetchMock
      .mockResolvedValueOnce(response(true, 200, ['session_id=abc; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=def; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=ghi; Path=/']));

    const service = createService();

    await service.ensureSession();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://accounts.sapo.vn/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );

    const firstBody = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(firstBody.get('phoneNumber')).toBe('901234567');
    expect(firstBody.get('password')).toBe('secret');
    expect(firstBody.get('clientId')).toBe('sapo-client');
    expect(firstBody.get('countryCode')).toBe('84');
    expect(firstBody.get('Product')).toBe('pos');
    expect(firstBody.get('suffix-domain')).toBe('mysapogo.com');

    expect(service.getCookieHeader()).toBe('session_id=abc; oauth_id=def; admin_id=ghi');
  });

  it('refreshes the session and retries a Sapo request once after 401', async () => {
    fetchMock
      .mockResolvedValueOnce(response(true, 200, ['session_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=old; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=old; Path=/']))
      .mockResolvedValueOnce(response(false, 401))
      .mockResolvedValueOnce(response(true, 200, ['session_id=new; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['oauth_id=new; Path=/']))
      .mockResolvedValueOnce(response(true, 200, ['admin_id=new; Path=/']))
      .mockResolvedValueOnce(response(true, 200));

    const service = createService();

    const result = await service.fetchWithSession('https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50');

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
      expect.objectContaining({
        headers: expect.objectContaining({ Cookie: 'session_id=new; oauth_id=new; admin_id=new' }),
      }),
    );
  });

  it('throws a clear error when login fails', async () => {
    fetchMock.mockResolvedValueOnce(response(false, 403));

    const service = createService();

    await expect(service.ensureSession()).rejects.toThrow('Sapo login failed with status 403');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/sapo/sapo-session.service.spec.ts
```

Expected: FAIL because `sapo-session.service.ts` does not exist.

- [ ] **Step 3: Implement SapoSessionService**

Create `sapo-session.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SapoSessionService {
  private readonly cookies = new Map<string, string>();
  private loginPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async ensureSession(): Promise<void> {
    if (this.cookies.size > 0) {
      return;
    }

    await this.refreshSession();
  }

  async refreshSession(): Promise<void> {
    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => {
        this.loginPromise = null;
      });
    }

    await this.loginPromise;
  }

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async fetchWithSession(input: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
    await this.ensureSession();

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const response = await fetch(input, {
        ...init,
        headers: {
          ...this.toHeaderObject(init.headers),
          Cookie: this.getCookieHeader(),
        },
      });

      this.storeCookies(response);

      if (response.status !== 401 || attempt === attempts) {
        return response;
      }

      this.cookies.clear();
      await this.refreshSession();
    }

    throw new Error('Sapo request failed after session refresh attempts');
  }

  private async login(): Promise<void> {
    this.cookies.clear();

    const accountBaseUrl = this.requiredConfig('sapo.accountBaseUrl');
    const sapoBaseUrl = this.requiredConfig('sapo.baseUrl');
    const clientId = this.requiredConfig('sapo.clientId');
    const shopDomain = this.requiredConfig('sapo.shopDomain');

    const loginBody = new URLSearchParams({
      phoneNumber: this.requiredConfig('sapo.phoneNumber'),
      password: this.requiredConfig('sapo.password'),
      clientId,
      countryCode: '84',
      isFixedDomain: 'false',
      Product: 'pos',
      'suffix-domain': 'mysapogo.com',
    });

    await this.fetchLoginStep(`${accountBaseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody,
    }, 'Sapo login');

    const authorizeUrl = new URL(`${accountBaseUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', `${sapoBaseUrl}/admin/oauth/callback`);
    authorizeUrl.searchParams.set('state', shopDomain);
    authorizeUrl.searchParams.set('scope', 'profile');
    authorizeUrl.searchParams.set('response_type', 'code');

    await this.fetchLoginStep(authorizeUrl.toString(), {
      method: 'GET',
      headers: {
        Cookie: this.getCookieHeader(),
        Referer: `${sapoBaseUrl}/`,
      },
    }, 'Sapo authorize');

    await this.fetchLoginStep(`${sapoBaseUrl}/admin/authorization/login?returnUrl=/admin`, {
      method: 'GET',
      headers: {
        Cookie: this.getCookieHeader(),
        Referer: `${sapoBaseUrl}/`,
      },
    }, 'Sapo admin authorization');
  }

  private async fetchLoginStep(url: string, init: RequestInit, label: string): Promise<void> {
    const response = await fetch(url, init);
    this.storeCookies(response);

    if (!response.ok) {
      throw new Error(`${label} failed with status ${response.status}`);
    }
  }

  private storeCookies(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookieHeaders = headers.getSetCookie?.() ?? this.splitSetCookieHeader(headers.get('set-cookie'));

    for (const cookieHeader of setCookieHeaders) {
      const [pair] = cookieHeader.split(';');
      const separator = pair.indexOf('=');

      if (separator <= 0) {
        continue;
      }

      this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  }

  private splitSetCookieHeader(header: string | null): string[] {
    if (!header) {
      return [];
    }

    return header.split(/,(?=\s*[^;]+=)/).map((value) => value.trim());
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required Sapo config: ${key}`);
    }

    return value;
  }

  private toHeaderObject(headers: HeadersInit | undefined): Record<string, string> {
    if (!headers) {
      return {};
    }

    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }

    if (Array.isArray(headers)) {
      return Object.fromEntries(headers);
    }

    return headers;
  }
}
```

- [ ] **Step 4: Register the service in SapoModule**

Update `sapo.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SapoClient } from './sapo.client';
import { SapoSessionService } from './sapo-session.service';

@Module({
  providers: [SapoClient, SapoSessionService],
  exports: [SapoClient, SapoSessionService],
})
export class SapoModule {}
```

- [ ] **Step 5: Run Sapo session tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/sapo/sapo-session.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add fitme-sportswear-backend/src/modules/sapo/sapo-session.service.ts fitme-sportswear-backend/src/modules/sapo/sapo-session.service.spec.ts fitme-sportswear-backend/src/modules/sapo/sapo.module.ts
git commit -m "feat: add Sapo session login service"
```

---

### Task 3: Implement Sapo product fetch client

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/sapo/sapo.client.ts`
- Create: `fitme-sportswear-backend/src/modules/sapo/sapo.client.spec.ts`

- [ ] **Step 1: Write failing Sapo client tests**

Create `sapo.client.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { SapoClient } from './sapo.client';
import { SapoSessionService } from './sapo-session.service';

describe('SapoClient', () => {
  const fetchWithSession = jest.fn();

  function createClient() {
    const configService = {
      get: jest.fn((key: string) => ({ 'sapo.baseUrl': 'https://fitme-sportswear.mysapogo.com' })[key]),
      getOrThrow: jest.fn((key: string) => ({ 'sapo.baseUrl': 'https://fitme-sportswear.mysapogo.com' })[key]),
    } as unknown as ConfigService;

    const sessionService = { fetchWithSession } as unknown as SapoSessionService;

    return new SapoClient(configService, sessionService);
  }

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches paginated Sapo products and flattens product pages', async () => {
    fetchWithSession
      .mockResolvedValueOnce(jsonResponse({
        products: [{ id: 'p1', name: 'Áo Fitme', variants: [] }],
        metadata: { total: 2 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        products: [{ id: 'p2', name: 'Quần Fitme', variants: [] }],
        metadata: { total: 2 },
      }))
      .mockResolvedValueOnce(jsonResponse({ products: [] }));

    const client = createClient();

    const products = await client.fetchProducts();

    expect(products).toEqual([
      { id: 'p1', name: 'Áo Fitme', variants: [] },
      { id: 'p2', name: 'Quần Fitme', variants: [] },
    ]);
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      1,
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=1&limit=50',
    );
    expect(fetchWithSession).toHaveBeenNthCalledWith(
      2,
      'https://fitme-sportswear.mysapogo.com/admin/products/search.json?page=2&limit=50',
    );
  });

  it('throws a clear error for non-2xx product responses', async () => {
    fetchWithSession.mockResolvedValueOnce(jsonResponse({ message: 'forbidden' }, false, 403));

    await expect(createClient().fetchProducts()).rejects.toThrow('Sapo product fetch failed with status 403');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/sapo/sapo.client.spec.ts
```

Expected: FAIL because constructor and `fetchProducts()` still use placeholder behavior.

- [ ] **Step 3: Implement SapoClient**

Replace `sapo.client.ts` with:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SapoSessionService } from './sapo-session.service';

export interface SapoProductResponse {
  id: string;
  name: string;
  variants: Array<{
    id: string;
    sku: string;
    variantRetailPrice: number;
    inventories: Array<{
      available: number;
      onHand: number;
    }>;
  }>;
}

interface SapoProductsPage {
  products?: SapoProductResponse[];
  metadata?: {
    total?: number;
  };
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

    for (let page = 1; ; page += 1) {
      const url = new URL('/admin/products/search.json', this.getBaseUrl());
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(this.pageLimit));

      const response = await this.sessionService.fetchWithSession(url.toString());

      if (!response.ok) {
        throw new Error(`Sapo product fetch failed with status ${response.status}`);
      }

      const body = (await response.json()) as SapoProductsPage;
      const pageProducts = body.products ?? [];

      if (pageProducts.length === 0) {
        break;
      }

      products.push(...pageProducts);

      if (body.metadata?.total !== undefined && products.length >= body.metadata.total) {
        break;
      }

      if (pageProducts.length < this.pageLimit) {
        break;
      }
    }

    return products;
  }
}
```

- [ ] **Step 4: Run Sapo tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/sapo/sapo-session.service.spec.ts src/modules/sapo/sapo.client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add fitme-sportswear-backend/src/modules/sapo/sapo.client.ts fitme-sportswear-backend/src/modules/sapo/sapo.client.spec.ts
git commit -m "feat: fetch Sapo products from API"
```

---

### Task 4: Implement Pancake product and inventory client

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/pancake/pancake.client.ts`
- Create: `fitme-sportswear-backend/src/modules/pancake/pancake.client.spec.ts`

- [ ] **Step 1: Write failing Pancake client tests**

Create `pancake.client.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { PancakeClient } from './pancake.client';

describe('PancakeClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createClient(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      'pancake.baseUrl': 'https://pos.pages.fm/api/v1',
      'pancake.apiKey': 'pancake-key',
      'pancake.shopId': 'shop-1',
      ...overrides,
    };

    const configService = {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (!value) {
          throw new Error(`Missing ${key}`);
        }
        return value;
      }),
    } as unknown as ConfigService;

    return new PancakeClient(configService);
  }

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  it('fetches variation pages with api_key, page_size, and page_number', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'v1', displayId: 'SKU-1', productId: 'p1', product: { name: 'Áo' }, retailPrice: 100000, variationsWarehouses: [] }],
        total_pages: 2,
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'v2', displayId: 'SKU-2', productId: 'p2', product: { name: 'Quần' }, retailPrice: 200000, variationsWarehouses: [] }],
        total_pages: 2,
      }));

    const products = await createClient().fetchProducts();

    expect(products).toHaveLength(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://pos.pages.fm/api/v1/shops/shop-1/products/variations?page_size=100&page_number=1&api_key=pancake-key',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://pos.pages.fm/api/v1/shops/shop-1/products/variations?page_size=100&page_number=2&api_key=pancake-key',
    );
  });

  it('stops pagination when data is empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [], total_pages: 5 }));

    const products = await createClient().fetchProducts();

    expect(products).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends variations_warehouses payload for quantity update', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await createClient().updateInventory({ variantId: 'variant-1', warehouseId: 'warehouse-1', available: 12 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pos.pages.fm/api/v1/shops/shop-1/variations/variant-1/update_quantity?api_key=pancake-key',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variations_warehouses: [
            { warehouse_id: 'warehouse-1', remain_quantity: 12 },
          ],
        }),
      },
    );
  });

  it('throws when updateInventory receives no warehouse id', async () => {
    await expect(createClient().updateInventory({ variantId: 'variant-1', warehouseId: null, available: 12 })).rejects.toThrow(
      'Pancake warehouseId is required for inventory update',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/pancake/pancake.client.spec.ts
```

Expected: FAIL because `fetchProducts()` returns `[]` and `updateInventory()` is a no-op.

- [ ] **Step 3: Implement PancakeClient**

Replace `pancake.client.ts` with:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PancakeProductResponse {
  displayId: string;
  productId: string;
  id: string;
  product: {
    name: string;
  };
  retailPrice: number;
  variationsWarehouses: Array<{
    warehouseId: string;
    remainQuantity: number;
    actualRemainQuantity: number;
  }>;
}

export interface PancakeInventoryUpdateInput {
  variantId: string;
  warehouseId: string | null;
  available: number;
}

interface PancakeVariationsPage {
  data?: PancakeProductResponse[];
  total_pages?: number;
  totalPages?: number;
}

@Injectable()
export class PancakeClient {
  private readonly pageSize = 100;

  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('pancake.baseUrl');
  }

  async fetchProducts(): Promise<PancakeProductResponse[]> {
    const products: PancakeProductResponse[] = [];

    for (let pageNumber = 1; ; pageNumber += 1) {
      const url = new URL(`/api/v1/shops/${this.requiredConfig('pancake.shopId')}/products/variations`, this.normalizedBaseUrl());
      url.searchParams.set('page_size', String(this.pageSize));
      url.searchParams.set('page_number', String(pageNumber));
      url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Pancake product fetch failed with status ${response.status}`);
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

  async updateInventory(input: PancakeInventoryUpdateInput): Promise<void> {
    if (!input.warehouseId) {
      throw new Error('Pancake warehouseId is required for inventory update');
    }

    const url = new URL(`/api/v1/shops/${this.requiredConfig('pancake.shopId')}/variations/${input.variantId}/update_quantity`, this.normalizedBaseUrl());
    url.searchParams.set('api_key', this.requiredConfig('pancake.apiKey'));

    const response = await fetch(url.toString(), {
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
      throw new Error(`Pancake inventory update failed with status ${response.status}`);
    }
  }

  private normalizedBaseUrl(): string {
    const baseUrl = this.getBaseUrl().replace(/\/$/, '');
    return baseUrl.endsWith('/api/v1') ? baseUrl.slice(0, -'/api/v1'.length) : baseUrl;
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required Pancake config: ${key}`);
    }

    return value;
  }
}
```

- [ ] **Step 4: Run Pancake tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/pancake/pancake.client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add fitme-sportswear-backend/src/modules/pancake/pancake.client.ts fitme-sportswear-backend/src/modules/pancake/pancake.client.spec.ts
git commit -m "feat: fetch and update Pancake inventory"
```

---

### Task 5: Implement Shopify product fetch client

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/shopify/shopify.client.ts`
- Create: `fitme-sportswear-backend/src/modules/shopify/shopify.client.spec.ts`

- [ ] **Step 1: Write failing Shopify product fetch tests**

Create `shopify.client.spec.ts` with the product fetch tests first:

```ts
import { ConfigService } from '@nestjs/config';
import { ShopifyClient } from './shopify.client';

describe('ShopifyClient', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  function createClient(overrides: Record<string, string | undefined> = {}) {
    const values: Record<string, string | undefined> = {
      'shopify.baseUrl': 'https://fitme.myshopify.com/admin/api/2024-04',
      'shopify.accessToken': 'shopify-token',
      'shopify.apiVersion': '2024-04',
      'shopify.locationId': undefined,
      ...overrides,
    };

    const configService = {
      get: jest.fn((key: string) => values[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = values[key];
        if (!value) {
          throw new Error(`Missing ${key}`);
        }
        return value;
      }),
    } as unknown as ConfigService;

    return new ShopifyClient(configService);
  }

  function jsonResponse(body: unknown, ok = true, status = 200, link: string | null = null) {
    return {
      ok,
      status,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'link' ? link : null),
      },
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it('fetches Shopify products with token header and follows Link rel next pagination', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(
        { products: [{ id: 'p1', title: 'Áo', variants: [] }] },
        true,
        200,
        '<https://fitme.myshopify.com/admin/api/2024-04/products.json?limit=250&page_info=next-page>; rel="next"',
      ))
      .mockResolvedValueOnce(jsonResponse({ products: [{ id: 'p2', title: 'Quần', variants: [] }] }));

    const products = await createClient().fetchProducts();

    expect(products).toEqual([
      { id: 'p1', title: 'Áo', variants: [] },
      { id: 'p2', title: 'Quần', variants: [] },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://fitme.myshopify.com/admin/api/2024-04/products.json?limit=250&fields=id%2Ctitle%2Cvendor%2Cproduct_type%2Cstatus%2Cimages%2Cvariants',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/products.json?limit=250&page_info=next-page',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
  });

  it('throws a clear error for non-2xx product responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errors: 'Unauthorized' }, false, 401));

    await expect(createClient().fetchProducts()).rejects.toThrow('Shopify product fetch failed with status 401');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/shopify/shopify.client.spec.ts
```

Expected: FAIL because `fetchProducts()` returns `[]`.

- [ ] **Step 3: Implement Shopify product fetch only**

Replace the top of `shopify.client.ts` with this implementation, leaving `updateInventoryAndPrice()` as a temporary throwing method until Task 6:

```ts
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

interface ShopifyProductsPage {
  products?: ShopifyProductResponse[];
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
        throw new Error(`Shopify product fetch failed with status ${response.status}`);
      }

      const body = (await response.json()) as ShopifyProductsPage;
      products.push(...(body.products ?? []));
      url = this.extractNextLink(response.headers.get('link'));
    }

    return products;
  }

  async updateInventoryAndPrice(input: ShopifyInventoryUpdateInput): Promise<void> {
    void input;
    throw new Error('Shopify inventory update is not implemented yet');
  }

  private buildProductsUrl(): string {
    const url = new URL('/products.json', `${this.getBaseUrl().replace(/\/$/, '')}/`);
    url.searchParams.set('limit', '250');
    url.searchParams.set('fields', 'id,title,vendor,product_type,status,images,variants');
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

  private authHeaders(): Record<string, string> {
    return { 'X-Shopify-Access-Token': this.requiredConfig('shopify.accessToken') };
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required Shopify config: ${key}`);
    }

    return value;
  }
}
```

- [ ] **Step 4: Run Shopify fetch tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/shopify/shopify.client.spec.ts
```

Expected: PASS for the two product fetch tests.

- [ ] **Step 5: Commit**

```bash
git add fitme-sportswear-backend/src/modules/shopify/shopify.client.ts fitme-sportswear-backend/src/modules/shopify/shopify.client.spec.ts
git commit -m "feat: fetch Shopify products from API"
```

---

### Task 6: Implement Shopify inventory update and location fallback

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/shopify/shopify.client.ts`
- Modify: `fitme-sportswear-backend/src/modules/shopify/shopify.client.spec.ts`

- [ ] **Step 1: Append failing Shopify inventory tests**

Add these tests inside the existing `describe('ShopifyClient', ...)` block in `shopify.client.spec.ts`:

```ts
  it('fetches and caches the first Shopify location when location id is not configured', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        variant: { id: 'variant-1', inventory_item_id: 'inventory-item-1', inventory_management: 'shopify', price: '150000' },
      }))
      .mockResolvedValueOnce(jsonResponse({ locations: [{ id: 'location-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 7 } }))
      .mockResolvedValueOnce(jsonResponse({
        variant: { id: 'variant-2', inventory_item_id: 'inventory-item-2', inventory_management: 'shopify', price: '180000' },
      }))
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 8 } }));

    const client = createClient();

    await client.updateInventoryAndPrice({ variantId: 'variant-1', available: 7, retailPrice: 150000 });
    await client.updateInventoryAndPrice({ variantId: 'variant-2', available: 8, retailPrice: 180000 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://fitme.myshopify.com/admin/api/2024-04/locations.json',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('uses variant inventory_item_id and sends inventory level set payload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        variant: { id: 'variant-1', inventory_item_id: 'inventory-item-1', inventory_management: 'shopify', price: '150000' },
      }))
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 7 } }));

    await createClient({ 'shopify.locationId': 'location-9' }).updateInventoryAndPrice({
      variantId: 'variant-1',
      available: 7,
      retailPrice: 150000,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://fitme.myshopify.com/admin/api/2024-04/variants/variant-1.json',
      { headers: { 'X-Shopify-Access-Token': 'shopify-token' } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/inventory_levels/set.json',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          inventory_item_id: 'inventory-item-1',
          location_id: 'location-9',
          available: 7,
        }),
      },
    );
  });

  it('updates variant inventory management while preserving existing price', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        variant: { id: 'variant-1', inventory_item_id: 'inventory-item-1', inventory_management: null, price: '150000', sku: 'SKU-1' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        variant: { id: 'variant-1', inventory_item_id: 'inventory-item-1', inventory_management: 'shopify', price: '150000', sku: 'SKU-1' },
      }))
      .mockResolvedValueOnce(jsonResponse({ inventory_level: { available: 7 } }));

    await createClient({ 'shopify.locationId': 'location-9' }).updateInventoryAndPrice({
      variantId: 'variant-1',
      available: 7,
      retailPrice: 999999,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://fitme.myshopify.com/admin/api/2024-04/variants/variant-1.json',
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': 'shopify-token',
        },
        body: JSON.stringify({
          variant: {
            id: 'variant-1',
            inventory_management: 'shopify',
            price: '150000',
          },
        }),
      },
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/shopify/shopify.client.spec.ts
```

Expected: FAIL because `updateInventoryAndPrice()` still throws.

- [ ] **Step 3: Implement inventory update helpers**

Replace `updateInventoryAndPrice()` in `shopify.client.ts` and add the helper interfaces/methods below inside the same file:

```ts
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
```

```ts
  async updateInventoryAndPrice(input: ShopifyInventoryUpdateInput): Promise<void> {
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
      throw new Error(`Shopify inventory level update failed with status ${response.status}`);
    }
  }

  private async fetchVariant(variantId: string): Promise<ShopifyVariantResponse['variant']> {
    const response = await fetch(this.apiUrl(`/variants/${variantId}.json`), { headers: this.authHeaders() });

    if (!response.ok) {
      throw new Error(`Shopify variant fetch failed with status ${response.status}`);
    }

    const body = (await response.json()) as ShopifyVariantResponse;
    return body.variant;
  }

  private async enableShopifyInventoryManagement(variant: ShopifyVariantResponse['variant']): Promise<void> {
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
      throw new Error(`Shopify variant update failed with status ${response.status}`);
    }
  }

  private async getLocationId(): Promise<string> {
    const configuredLocationId = this.configService.get<string>('shopify.locationId');
    if (configuredLocationId) {
      return configuredLocationId;
    }

    if (this.cachedLocationId) {
      return this.cachedLocationId;
    }

    const response = await fetch(this.apiUrl('/locations.json'), { headers: this.authHeaders() });

    if (!response.ok) {
      throw new Error(`Shopify locations fetch failed with status ${response.status}`);
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
    return new URL(path.replace(/^\//, ''), `${this.getBaseUrl().replace(/\/$/, '')}/`).toString();
  }

  private jsonHeaders(): Record<string, string> {
    return {
      ...this.authHeaders(),
      'Content-Type': 'application/json',
    };
  }
```

Ensure `buildProductsUrl()` uses `this.apiUrl('/products.json')` so URL building stays consistent:

```ts
  private buildProductsUrl(): string {
    const url = new URL(this.apiUrl('/products.json'));
    url.searchParams.set('limit', '250');
    url.searchParams.set('fields', 'id,title,vendor,product_type,status,images,variants');
    return url.toString();
  }
```

- [ ] **Step 4: Run Shopify tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/shopify/shopify.client.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add fitme-sportswear-backend/src/modules/shopify/shopify.client.ts fitme-sportswear-backend/src/modules/shopify/shopify.client.spec.ts
git commit -m "feat: update Shopify inventory levels"
```

---

### Task 7: Verify real client contracts with existing sync services

**Files:**
- Modify if needed: `fitme-sportswear-backend/src/modules/products/product-snapshot.service.spec.ts`
- Verify: `fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.spec.ts`
- Verify: `fitme-sportswear-backend/src/modules/products/product-matching.service.spec.ts`
- Verify: `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.spec.ts`

- [ ] **Step 1: Run existing product sync tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/products/product-snapshot.mapper.spec.ts src/modules/products/product-matching.service.spec.ts src/modules/products/product-snapshot.service.spec.ts src/modules/products/product-sync-orchestrator.service.spec.ts
```

Expected: PASS. If a type mismatch appears because real client fields are stricter than mapper fixtures, fix the fixture shape without changing mapper behavior.

- [ ] **Step 2: Add one lightweight contract-shape test if missing**

Only if no existing `ProductSnapshotService` test covers a real Sapo/Pancake/Shopify client response object, add this test to `product-snapshot.service.spec.ts`:

```ts
  it('persists snapshots from real client contract-shaped responses', async () => {
    sapoClient.fetchProducts.mockResolvedValueOnce([
      {
        id: 'sapo-product-1',
        name: 'Áo Sapo',
        variants: [
          {
            id: 'sapo-variant-1',
            sku: 'SKU-REAL-1',
            variantRetailPrice: 100000,
            inventories: [{ available: 5, onHand: 6 }],
          },
        ],
      },
    ]);
    pancakeClient.fetchProducts.mockResolvedValueOnce([
      {
        id: 'pancake-variant-1',
        productId: 'pancake-product-1',
        displayId: 'SKU-REAL-1',
        product: { name: 'Áo Pancake' },
        retailPrice: 100000,
        variationsWarehouses: [
          { warehouseId: 'warehouse-1', remainQuantity: 5, actualRemainQuantity: 6 },
        ],
      },
    ]);
    shopifyClient.fetchProducts.mockResolvedValueOnce([
      {
        id: 'shopify-product-1',
        title: 'Áo Shopify',
        variants: [
          {
            id: 'shopify-variant-1',
            sku: 'SKU-REAL-1',
            title: 'Default Title',
            available: 5,
            inventoryQuantity: 6,
            price: 100000,
          },
        ],
      },
    ]);

    const snapshots = await service.refreshAllSnapshots();

    expect(snapshots.map((snapshot) => snapshot.platform)).toEqual(['sapo', 'pancake', 'shopify']);
    expect(snapshots.every((snapshot) => snapshot.sku === 'SKU-REAL-1')).toBe(true);
  });
```

- [ ] **Step 3: Run product sync tests again**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand src/modules/products/product-snapshot.mapper.spec.ts src/modules/products/product-matching.service.spec.ts src/modules/products/product-snapshot.service.spec.ts src/modules/products/product-sync-orchestrator.service.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit if Step 2 changed tests**

If `product-snapshot.service.spec.ts` changed:

```bash
git add fitme-sportswear-backend/src/modules/products/product-snapshot.service.spec.ts
git commit -m "test: verify real product client snapshot contracts"
```

If no file changed, do not create an empty commit.

---

### Task 8: Full verification

**Files:**
- Verify all changed source and spec files.

- [ ] **Step 1: Run all Jest tests**

```bash
cd fitme-sportswear-backend && npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run build**

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Run lint and record known tooling issue if unchanged**

```bash
cd fitme-sportswear-backend && npm run lint
```

Expected: Either PASS, or FAIL only with the known ESLint 9 flat config error:

```text
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

If lint fails for TypeScript/code issues, fix them before continuing. If lint fails only for the known flat config issue, mention that in final completion notes and do not change ESLint config in this phase.

- [ ] **Step 4: Review git diff for accidental scope creep**

```bash
git diff --stat HEAD
git diff HEAD -- fitme-sportswear-backend/src/modules/sapo fitme-sportswear-backend/src/modules/pancake fitme-sportswear-backend/src/modules/shopify fitme-sportswear-backend/src/modules/config fitme-sportswear-backend/src/modules/products
```

Expected: Changes are limited to config, Sapo/Pancake/Shopify clients/tests, Sapo module, and optional lightweight product snapshot test.

- [ ] **Step 5: Commit verification-only fixes if any**

If Step 1-4 required code/test fixes:

```bash
git add fitme-sportswear-backend/src/modules/sapo fitme-sportswear-backend/src/modules/pancake fitme-sportswear-backend/src/modules/shopify fitme-sportswear-backend/src/modules/config fitme-sportswear-backend/src/modules/products
git commit -m "fix: stabilize real product integration clients"
```

If no files changed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Sapo session login, cookies, refresh, 401 retry: Task 2.
  - Sapo paginated product fetch: Task 3.
  - Pancake variation fetch and quantity update: Task 4.
  - Shopify product fetch, Link pagination, location fallback, variant lookup/update, inventory level set: Tasks 5-6.
  - Config/env validation: Task 1.
  - Existing sync integration remains stable: Task 7.
  - Full test/build/lint acceptance: Task 8.
- Placeholder scan:
  - No placeholder implementation steps remain.
  - No real external API calls are used in tests; all HTTP behavior is mocked through `global.fetch`.
- Type consistency:
  - Public method names match existing clients.
  - Existing product response interfaces remain the boundary consumed by mappers.
  - `InventorySyncService` can keep passing `retailPrice`; Shopify client preserves existing Shopify price by default.
