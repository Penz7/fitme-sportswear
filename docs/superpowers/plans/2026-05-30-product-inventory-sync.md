# Product Inventory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build phase-one product and inventory sync that snapshots Sapo, Pancake, and Shopify products, matches by SKU, and syncs Sapo inventory/price to existing Pancake/Shopify records without auto-creating products.

**Architecture:** The implementation extends the existing NestJS backend with Prisma snapshot models, focused product sync services, and a BullMQ job. Sapo remains the source of truth; Pancake and Shopify are receiving channels for matched SKUs only.

**Tech Stack:** NestJS 10, TypeScript, Prisma 6, PostgreSQL, BullMQ, Jest, class-validator.

---

## File Structure

Create and modify these files:

- Modify `prisma/schema.prisma`: add product snapshot models, product mapping model, and mapping status enum.
- Create `src/modules/products/products.module.ts`: owns product sync services and exports orchestration service.
- Create `src/modules/products/types/platform-product-snapshot.ts`: shared normalized snapshot and mapping types.
- Create `src/modules/products/product-snapshot.mapper.ts`: pure functions that normalize raw Sapo/Pancake/Shopify API payloads.
- Create `src/modules/products/product-snapshot.mapper.spec.ts`: mapper unit tests.
- Create `src/modules/products/product-matching.service.ts`: SKU matching and conflict classification.
- Create `src/modules/products/product-matching.service.spec.ts`: matching unit tests.
- Create `src/modules/products/product-snapshot.service.ts`: fetch and upsert platform snapshots.
- Create `src/modules/products/inventory-sync.service.ts`: update receiving platforms from Sapo values.
- Create `src/modules/products/product-sync-orchestrator.service.ts`: run full product inventory sync and write `SyncRun` metadata.
- Create `src/modules/products/product-sync-orchestrator.service.spec.ts`: orchestration unit tests with mocked dependencies.
- Modify `src/modules/sapo/sapo.client.ts`: add product fetch method placeholder contract used by sync services.
- Modify `src/modules/pancake/pancake.client.ts`: add product fetch and inventory update method contracts.
- Modify `src/modules/shopify/shopify.client.ts`: add product fetch and inventory/price update method contracts.
- Modify `src/modules/queue/queue.constants.ts`: add product sync queue/job names.
- Create `src/modules/queue/producers/product-sync.producer.ts`: enqueue product sync jobs.
- Create `src/modules/queue/processors/product-sync.processor.ts`: run product sync jobs.
- Modify `src/modules/queue/queue.module.ts`: register product sync queue, producer, and processor.
- Modify `src/modules/sync/sync.service.ts`: create and read product sync runs.
- Modify `src/modules/sync/sync.controller.ts`: expose `POST /sync/products` and `GET /sync/products/:id`.
- Modify `src/modules/sync/sync.module.ts`: import `ProductsModule` if needed for provider resolution through queue.
- Modify `src/app.module.ts`: import `ProductsModule` if it is not already imported through queue dependencies.
- Modify `.env.example`: document product sync related environment variables only if clients need already-required tokens.

---

### Task 1: Add Prisma product sync schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Extend Prisma schema**

Append this enum and models after `ExternalMapping` in `prisma/schema.prisma`:

```prisma
enum ProductMappingStatus {
  matched
  partial
  conflict
}

model SapoProduct {
  id          String   @id @default(uuid())
  sku         String   @unique
  productId   String?
  variantId   String?
  name        String?
  available   Int?
  remain      Int?
  retailPrice Decimal? @db.Decimal(18, 2)
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("sapo_products")
}

model PancakeProduct {
  id          String   @id @default(uuid())
  sku         String   @unique
  productId   String?
  variantId   String?
  name        String?
  available   Int?
  remain      Int?
  retailPrice Decimal? @db.Decimal(18, 2)
  warehouseId String?
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("pancake_products")
}

model ShopifyProduct {
  id          String   @id @default(uuid())
  sku         String   @unique
  productId   String?
  variantId   String?
  name        String?
  available   BigInt?
  remain      BigInt?
  retailPrice Decimal? @db.Decimal(18, 2)
  updatedBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("shopify_products")
}

model ProductMapping {
  id               String               @id @default(uuid())
  sku              String               @unique
  sapoProductId     String?
  sapoVariantId     String?
  pancakeProductId  String?
  pancakeVariantId  String?
  pancakeWarehouseId String?
  shopifyProductId  String?
  shopifyVariantId  String?
  status           ProductMappingStatus
  conflictReason   String?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  @@map("product_mappings")
}
```

- [ ] **Step 2: Format Prisma schema**

Run:

```bash
cd fitme-sportswear-backend && npx prisma format
```

Expected: Prisma formats `schema.prisma` successfully.

- [ ] **Step 3: Generate Prisma migration**

Run:

```bash
cd fitme-sportswear-backend && npx prisma migrate dev --name product_inventory_sync_schema
```

Expected: A migration appears under `prisma/migrations/*_product_inventory_sync_schema/` and Prisma Client regenerates.

- [ ] **Step 4: Commit schema changes**

Run:

```bash
git add fitme-sportswear-backend/prisma/schema.prisma fitme-sportswear-backend/prisma/migrations
git commit -m "$(cat <<'EOF'
Add product sync database schema

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 2: Add normalized product snapshot mapper

**Files:**
- Create: `src/modules/products/types/platform-product-snapshot.ts`
- Create: `src/modules/products/product-snapshot.mapper.ts`
- Create: `src/modules/products/product-snapshot.mapper.spec.ts`

- [ ] **Step 1: Write failing mapper tests**

Create `fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.spec.ts`:

```ts
import {
  mapPancakeProductSnapshot,
  mapSapoProductSnapshot,
  mapShopifyProductSnapshots,
} from './product-snapshot.mapper';

describe('product snapshot mapper', () => {
  it('maps Sapo variant and sums inventory availability', () => {
    const result = mapSapoProductSnapshot({
      id: 10,
      name: 'Áo chạy bộ',
      variants: [
        {
          id: 20,
          sku: 'SKU-1',
          variantRetailPrice: 150000,
          inventories: [
            { available: 2, onHand: 3 },
            { available: 4, onHand: 5 },
          ],
        },
      ],
    });

    expect(result).toEqual([
      {
        platform: 'sapo',
        sku: 'SKU-1',
        productId: '10',
        variantId: '20',
        name: 'Áo chạy bộ',
        available: 6,
        remain: 8,
        retailPrice: 150000,
        warehouseId: null,
      },
    ]);
  });

  it('maps Pancake displayId as SKU and sums warehouse quantities', () => {
    const result = mapPancakeProductSnapshot({
      displayId: 'SKU-2',
      productId: 'p-1',
      id: 'v-1',
      product: { name: 'Quần tập' },
      retailPrice: '200000',
      variationsWarehouses: [
        { warehouseId: 'w-1', remainQuantity: 7, actualRemainQuantity: 9 },
        { warehouseId: 'w-2', remainQuantity: 3, actualRemainQuantity: 5 },
      ],
    });

    expect(result).toEqual({
      platform: 'pancake',
      sku: 'SKU-2',
      productId: 'p-1',
      variantId: 'v-1',
      name: 'Quần tập',
      available: 10,
      remain: 14,
      retailPrice: 200000,
      warehouseId: 'w-1',
    });
  });

  it('maps Shopify variants with SKU', () => {
    const result = mapShopifyProductSnapshots({
      id: 'shop-product-1',
      title: 'Giày chạy',
      variants: [
        {
          id: 'variant-1',
          sku: 'SKU-3',
          title: 'Size 40',
          available: 11,
          inventoryQuantity: 12,
          price: '350000',
        },
      ],
    });

    expect(result).toEqual([
      {
        platform: 'shopify',
        sku: 'SKU-3',
        productId: 'shop-product-1',
        variantId: 'variant-1',
        name: 'Giày chạy - Size 40',
        available: 11,
        remain: 12,
        retailPrice: 350000,
        warehouseId: null,
      },
    ]);
  });

  it('drops products without usable SKU', () => {
    expect(mapSapoProductSnapshot({ id: 1, name: 'No SKU', variants: [{ id: 2, sku: '', inventories: [] }] })).toEqual([]);
    expect(mapPancakeProductSnapshot({ displayId: '', id: 'v', productId: 'p' })).toBeNull();
    expect(mapShopifyProductSnapshots({ id: 'p', title: 'No SKU', variants: [{ id: 'v', sku: '' }] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd fitme-sportswear-backend && npm test -- product-snapshot.mapper.spec.ts --runInBand
```

Expected: FAIL because mapper file does not exist.

- [ ] **Step 3: Add normalized types**

Create `fitme-sportswear-backend/src/modules/products/types/platform-product-snapshot.ts`:

```ts
export type ProductPlatform = 'sapo' | 'pancake' | 'shopify';

export interface PlatformProductSnapshot {
  platform: ProductPlatform;
  sku: string;
  productId: string | null;
  variantId: string | null;
  name: string | null;
  available: number | null;
  remain: number | null;
  retailPrice: number | null;
  warehouseId: string | null;
}

export interface ProductMappingCandidate {
  sku: string;
  sapo: PlatformProductSnapshot | null;
  pancake: PlatformProductSnapshot | null;
  shopify: PlatformProductSnapshot | null;
  status: 'matched' | 'partial' | 'conflict';
  conflictReason: string | null;
}
```

- [ ] **Step 4: Implement mapper functions**

Create `fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.ts`:

```ts
import { PlatformProductSnapshot } from './types/platform-product-snapshot';

interface SapoInventoryLike {
  available?: number | null;
  onHand?: number | null;
}

interface SapoVariantLike {
  id?: string | number | null;
  sku?: string | null;
  variantRetailPrice?: number | null;
  inventories?: SapoInventoryLike[] | null;
}

interface SapoProductLike {
  id?: string | number | null;
  name?: string | null;
  variants?: SapoVariantLike[] | null;
}

interface PancakeWarehouseLike {
  warehouseId?: string | null;
  remainQuantity?: number | null;
  actualRemainQuantity?: number | null;
}

interface PancakeProductLike {
  displayId?: string | null;
  productId?: string | number | null;
  id?: string | number | null;
  product?: { name?: string | null } | null;
  retailPrice?: string | number | null;
  variationsWarehouses?: PancakeWarehouseLike[] | null;
}

interface ShopifyVariantLike {
  id?: string | number | null;
  sku?: string | null;
  title?: string | null;
  available?: number | null;
  inventoryQuantity?: number | null;
  price?: string | number | null;
}

interface ShopifyProductLike {
  id?: string | number | null;
  title?: string | null;
  variants?: ShopifyVariantLike[] | null;
}

function toStringOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

function toNumberOrNull(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + (value ?? 0), 0);
}

export function mapSapoProductSnapshot(product: SapoProductLike): PlatformProductSnapshot[] {
  return (product.variants ?? [])
    .filter((variant) => Boolean(variant.sku?.trim()))
    .map((variant) => ({
      platform: 'sapo' as const,
      sku: variant.sku!.trim(),
      productId: toStringOrNull(product.id),
      variantId: toStringOrNull(variant.id),
      name: product.name ?? null,
      available: sum((variant.inventories ?? []).map((inventory) => inventory.available)),
      remain: sum((variant.inventories ?? []).map((inventory) => inventory.onHand)),
      retailPrice: variant.variantRetailPrice ?? null,
      warehouseId: null,
    }));
}

export function mapPancakeProductSnapshot(product: PancakeProductLike): PlatformProductSnapshot | null {
  const sku = product.displayId?.trim();

  if (!sku) {
    return null;
  }

  const warehouses = product.variationsWarehouses ?? [];

  return {
    platform: 'pancake',
    sku,
    productId: toStringOrNull(product.productId),
    variantId: toStringOrNull(product.id),
    name: product.product?.name ?? null,
    available: sum(warehouses.map((warehouse) => warehouse.remainQuantity)),
    remain: sum(warehouses.map((warehouse) => warehouse.actualRemainQuantity)),
    retailPrice: toNumberOrNull(product.retailPrice),
    warehouseId: warehouses[0]?.warehouseId ?? null,
  };
}

export function mapShopifyProductSnapshots(product: ShopifyProductLike): PlatformProductSnapshot[] {
  return (product.variants ?? [])
    .filter((variant) => Boolean(variant.sku?.trim()))
    .map((variant) => ({
      platform: 'shopify' as const,
      sku: variant.sku!.trim(),
      productId: toStringOrNull(product.id),
      variantId: toStringOrNull(variant.id),
      name: `${product.title ?? ''} - ${variant.title ?? ''}`.trim(),
      available: variant.available ?? variant.inventoryQuantity ?? null,
      remain: variant.inventoryQuantity ?? variant.available ?? null,
      retailPrice: toNumberOrNull(variant.price),
      warehouseId: null,
    }));
}
```

- [ ] **Step 5: Run mapper tests**

Run:

```bash
cd fitme-sportswear-backend && npm test -- product-snapshot.mapper.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit mapper**

Run:

```bash
git add fitme-sportswear-backend/src/modules/products/types/platform-product-snapshot.ts fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.ts fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.spec.ts
git commit -m "$(cat <<'EOF'
Add product snapshot mappers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 3: Add SKU matching service

**Files:**
- Create: `src/modules/products/product-matching.service.ts`
- Create: `src/modules/products/product-matching.service.spec.ts`

- [ ] **Step 1: Write failing matching tests**

Create `fitme-sportswear-backend/src/modules/products/product-matching.service.spec.ts`:

```ts
import { ProductMatchingService } from './product-matching.service';
import { PlatformProductSnapshot } from './types/platform-product-snapshot';

function snapshot(platform: PlatformProductSnapshot['platform'], sku: string): PlatformProductSnapshot {
  return {
    platform,
    sku,
    productId: `${platform}-product`,
    variantId: `${platform}-variant`,
    name: `${platform} ${sku}`,
    available: 5,
    remain: 5,
    retailPrice: 100000,
    warehouseId: platform === 'pancake' ? 'warehouse-1' : null,
  };
}

describe('ProductMatchingService', () => {
  const service = new ProductMatchingService();

  it('marks SKU with Sapo and receiving platform as matched', () => {
    const result = service.buildMappings([
      snapshot('sapo', 'SKU-1'),
      snapshot('pancake', 'SKU-1'),
      snapshot('shopify', 'SKU-1'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sku: 'SKU-1', status: 'matched', conflictReason: null });
  });

  it('marks SKU with only Sapo as partial', () => {
    const result = service.buildMappings([snapshot('sapo', 'SKU-2')]);

    expect(result[0]).toMatchObject({ sku: 'SKU-2', status: 'partial', conflictReason: 'Missing Pancake and Shopify records' });
  });

  it('marks duplicate SKU in one platform as conflict', () => {
    const result = service.buildMappings([
      snapshot('sapo', 'SKU-3'),
      snapshot('pancake', 'SKU-3'),
      snapshot('pancake', 'SKU-3'),
    ]);

    expect(result[0]).toMatchObject({ sku: 'SKU-3', status: 'conflict', conflictReason: 'Duplicate SKU in pancake' });
  });

  it('marks SKU without Sapo as partial and does not make it syncable', () => {
    const result = service.buildMappings([snapshot('shopify', 'SKU-4')]);

    expect(result[0]).toMatchObject({ sku: 'SKU-4', status: 'partial', conflictReason: 'Missing Sapo source record' });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
cd fitme-sportswear-backend && npm test -- product-matching.service.spec.ts --runInBand
```

Expected: FAIL because service file does not exist.

- [ ] **Step 3: Implement matching service**

Create `fitme-sportswear-backend/src/modules/products/product-matching.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PlatformProductSnapshot, ProductMappingCandidate, ProductPlatform } from './types/platform-product-snapshot';

@Injectable()
export class ProductMatchingService {
  buildMappings(snapshots: PlatformProductSnapshot[]): ProductMappingCandidate[] {
    const bySku = new Map<string, PlatformProductSnapshot[]>();

    for (const snapshot of snapshots) {
      const entries = bySku.get(snapshot.sku) ?? [];
      entries.push(snapshot);
      bySku.set(snapshot.sku, entries);
    }

    return [...bySku.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sku, entries]) => this.buildMapping(sku, entries));
  }

  private buildMapping(sku: string, entries: PlatformProductSnapshot[]): ProductMappingCandidate {
    const sapo = this.singlePlatform(entries, 'sapo');
    const pancake = this.singlePlatform(entries, 'pancake');
    const shopify = this.singlePlatform(entries, 'shopify');
    const duplicatePlatform = this.findDuplicatePlatform(entries);

    if (duplicatePlatform) {
      return { sku, sapo, pancake, shopify, status: 'conflict', conflictReason: `Duplicate SKU in ${duplicatePlatform}` };
    }

    if (!sapo) {
      return { sku, sapo, pancake, shopify, status: 'partial', conflictReason: 'Missing Sapo source record' };
    }

    if (!pancake && !shopify) {
      return { sku, sapo, pancake, shopify, status: 'partial', conflictReason: 'Missing Pancake and Shopify records' };
    }

    return { sku, sapo, pancake, shopify, status: 'matched', conflictReason: null };
  }

  private singlePlatform(entries: PlatformProductSnapshot[], platform: ProductPlatform) {
    return entries.find((entry) => entry.platform === platform) ?? null;
  }

  private findDuplicatePlatform(entries: PlatformProductSnapshot[]) {
    for (const platform of ['sapo', 'pancake', 'shopify'] as const) {
      if (entries.filter((entry) => entry.platform === platform).length > 1) {
        return platform;
      }
    }

    return null;
  }
}
```

- [ ] **Step 4: Run matching tests**

Run:

```bash
cd fitme-sportswear-backend && npm test -- product-matching.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit matching service**

Run:

```bash
git add fitme-sportswear-backend/src/modules/products/product-matching.service.ts fitme-sportswear-backend/src/modules/products/product-matching.service.spec.ts
git commit -m "$(cat <<'EOF'
Add SKU product matching service

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 4: Add platform client product contracts

**Files:**
- Modify: `src/modules/sapo/sapo.client.ts`
- Modify: `src/modules/pancake/pancake.client.ts`
- Modify: `src/modules/shopify/shopify.client.ts`

- [ ] **Step 1: Add Sapo product fetch contract**

Modify `fitme-sportswear-backend/src/modules/sapo/sapo.client.ts` to:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SapoProductResponse {
  id?: string | number | null;
  name?: string | null;
  variants?: Array<{
    id?: string | number | null;
    sku?: string | null;
    variantRetailPrice?: number | null;
    inventories?: Array<{ available?: number | null; onHand?: number | null }> | null;
  }> | null;
}

@Injectable()
export class SapoClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('sapo.baseUrl');
  }

  async fetchProducts(): Promise<SapoProductResponse[]> {
    return [];
  }
}
```

- [ ] **Step 2: Add Pancake product and update contracts**

Modify `fitme-sportswear-backend/src/modules/pancake/pancake.client.ts` to:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PancakeProductResponse {
  displayId?: string | null;
  productId?: string | number | null;
  id?: string | number | null;
  product?: { name?: string | null } | null;
  retailPrice?: string | number | null;
  variationsWarehouses?: Array<{
    warehouseId?: string | null;
    remainQuantity?: number | null;
    actualRemainQuantity?: number | null;
  }> | null;
}

export interface PancakeInventoryUpdateInput {
  variantId: string;
  warehouseId: string | null;
  available: number;
}

@Injectable()
export class PancakeClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('pancake.baseUrl');
  }

  async fetchProducts(): Promise<PancakeProductResponse[]> {
    return [];
  }

  async updateInventory(input: PancakeInventoryUpdateInput): Promise<void> {
    void input;
  }
}
```

- [ ] **Step 3: Add Shopify product and update contracts**

Modify `fitme-sportswear-backend/src/modules/shopify/shopify.client.ts` to:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ShopifyProductResponse {
  id?: string | number | null;
  title?: string | null;
  variants?: Array<{
    id?: string | number | null;
    sku?: string | null;
    title?: string | null;
    available?: number | null;
    inventoryQuantity?: number | null;
    price?: string | number | null;
  }> | null;
}

export interface ShopifyInventoryUpdateInput {
  variantId: string;
  available: number;
  retailPrice: number | null;
}

@Injectable()
export class ShopifyClient {
  constructor(private readonly configService: ConfigService) {}

  getBaseUrl() {
    return this.configService.getOrThrow<string>('shopify.baseUrl');
  }

  async fetchProducts(): Promise<ShopifyProductResponse[]> {
    return [];
  }

  async updateInventoryAndPrice(input: ShopifyInventoryUpdateInput): Promise<void> {
    void input;
  }
}
```

- [ ] **Step 4: Run TypeScript build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit client contracts**

Run:

```bash
git add fitme-sportswear-backend/src/modules/sapo/sapo.client.ts fitme-sportswear-backend/src/modules/pancake/pancake.client.ts fitme-sportswear-backend/src/modules/shopify/shopify.client.ts
git commit -m "$(cat <<'EOF'
Add product sync client contracts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 5: Add product snapshot persistence service

**Files:**
- Create: `src/modules/products/product-snapshot.service.ts`

- [ ] **Step 1: Implement snapshot persistence service**

Create `fitme-sportswear-backend/src/modules/products/product-snapshot.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PancakeClient } from '../pancake/pancake.client';
import { SapoClient } from '../sapo/sapo.client';
import { ShopifyClient } from '../shopify/shopify.client';
import { PrismaService } from '../database/prisma.service';
import { mapPancakeProductSnapshot, mapSapoProductSnapshot, mapShopifyProductSnapshots } from './product-snapshot.mapper';
import { PlatformProductSnapshot } from './types/platform-product-snapshot';

@Injectable()
export class ProductSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sapoClient: SapoClient,
    private readonly pancakeClient: PancakeClient,
    private readonly shopifyClient: ShopifyClient,
  ) {}

  async refreshAllSnapshots() {
    const sapo = await this.refreshSapoSnapshots();
    const pancake = await this.refreshPancakeSnapshots();
    const shopify = await this.refreshShopifySnapshots();

    return [...sapo, ...pancake, ...shopify];
  }

  async refreshSapoSnapshots() {
    const products = await this.sapoClient.fetchProducts();
    const snapshots = products.flatMap((product) => mapSapoProductSnapshot(product));

    for (const snapshot of snapshots) {
      await this.prisma.sapoProduct.upsert({
        where: { sku: snapshot.sku },
        create: this.toSapoData(snapshot),
        update: this.toSapoData(snapshot),
      });
    }

    return snapshots;
  }

  async refreshPancakeSnapshots() {
    const products = await this.pancakeClient.fetchProducts();
    const snapshots = products.map((product) => mapPancakeProductSnapshot(product)).filter((snapshot): snapshot is PlatformProductSnapshot => Boolean(snapshot));

    for (const snapshot of snapshots) {
      await this.prisma.pancakeProduct.upsert({
        where: { sku: snapshot.sku },
        create: this.toPancakeData(snapshot),
        update: this.toPancakeData(snapshot),
      });
    }

    return snapshots;
  }

  async refreshShopifySnapshots() {
    const products = await this.shopifyClient.fetchProducts();
    const snapshots = products.flatMap((product) => mapShopifyProductSnapshots(product));

    for (const snapshot of snapshots) {
      await this.prisma.shopifyProduct.upsert({
        where: { sku: snapshot.sku },
        create: this.toShopifyData(snapshot),
        update: this.toShopifyData(snapshot),
      });
    }

    return snapshots;
  }

  private toSapoData(snapshot: PlatformProductSnapshot): Prisma.SapoProductUncheckedCreateInput {
    return {
      sku: snapshot.sku,
      productId: snapshot.productId,
      variantId: snapshot.variantId,
      name: snapshot.name,
      available: snapshot.available,
      remain: snapshot.remain,
      retailPrice: snapshot.retailPrice,
      updatedBy: 'SAPO',
    };
  }

  private toPancakeData(snapshot: PlatformProductSnapshot): Prisma.PancakeProductUncheckedCreateInput {
    return {
      sku: snapshot.sku,
      productId: snapshot.productId,
      variantId: snapshot.variantId,
      name: snapshot.name,
      available: snapshot.available,
      remain: snapshot.remain,
      retailPrice: snapshot.retailPrice,
      warehouseId: snapshot.warehouseId,
      updatedBy: 'PANCAKE',
    };
  }

  private toShopifyData(snapshot: PlatformProductSnapshot): Prisma.ShopifyProductUncheckedCreateInput {
    return {
      sku: snapshot.sku,
      productId: snapshot.productId,
      variantId: snapshot.variantId,
      name: snapshot.name,
      available: snapshot.available,
      remain: snapshot.remain,
      retailPrice: snapshot.retailPrice,
      updatedBy: 'SHOPIFY',
    };
  }
}
```

- [ ] **Step 2: Run build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS. If Prisma types are missing, re-run `npx prisma generate`.

- [ ] **Step 3: Commit snapshot service**

Run:

```bash
git add fitme-sportswear-backend/src/modules/products/product-snapshot.service.ts
git commit -m "$(cat <<'EOF'
Persist platform product snapshots

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 6: Add inventory sync service

**Files:**
- Create: `src/modules/products/inventory-sync.service.ts`

- [ ] **Step 1: Implement inventory sync service**

Create `fitme-sportswear-backend/src/modules/products/inventory-sync.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PancakeClient } from '../pancake/pancake.client';
import { PrismaService } from '../database/prisma.service';
import { ShopifyClient } from '../shopify/shopify.client';
import { ProductMappingCandidate } from './types/platform-product-snapshot';

export interface ProductSyncError {
  sku: string;
  platform: 'pancake' | 'shopify';
  operation: string;
  message: string;
}

export interface InventorySyncResult {
  updatedPancake: number;
  updatedShopify: number;
  errors: ProductSyncError[];
}

@Injectable()
export class InventorySyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pancakeClient: PancakeClient,
    private readonly shopifyClient: ShopifyClient,
  ) {}

  async syncMappings(mappings: ProductMappingCandidate[]): Promise<InventorySyncResult> {
    const result: InventorySyncResult = { updatedPancake: 0, updatedShopify: 0, errors: [] };

    for (const mapping of mappings) {
      if (mapping.status === 'conflict' || !mapping.sapo || mapping.sapo.available === null) {
        continue;
      }

      if (mapping.pancake?.variantId) {
        try {
          await this.pancakeClient.updateInventory({
            variantId: mapping.pancake.variantId,
            warehouseId: mapping.pancake.warehouseId,
            available: mapping.sapo.available,
          });
          await this.prisma.pancakeProduct.update({
            where: { sku: mapping.sku },
            data: { available: mapping.sapo.available, retailPrice: mapping.sapo.retailPrice, updatedBy: 'SAPO' },
          });
          result.updatedPancake += 1;
        } catch (error) {
          result.errors.push(this.toError(mapping.sku, 'pancake', 'updateInventory', error));
        }
      }

      if (mapping.shopify?.variantId) {
        try {
          await this.shopifyClient.updateInventoryAndPrice({
            variantId: mapping.shopify.variantId,
            available: mapping.sapo.available,
            retailPrice: mapping.sapo.retailPrice,
          });
          await this.prisma.shopifyProduct.update({
            where: { sku: mapping.sku },
            data: { available: mapping.sapo.available, retailPrice: mapping.sapo.retailPrice, updatedBy: 'SAPO' },
          });
          result.updatedShopify += 1;
        } catch (error) {
          result.errors.push(this.toError(mapping.sku, 'shopify', 'updateInventoryAndPrice', error));
        }
      }
    }

    return result;
  }

  private toError(sku: string, platform: ProductSyncError['platform'], operation: string, error: unknown): ProductSyncError {
    return {
      sku,
      platform,
      operation,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

- [ ] **Step 2: Run build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit inventory service**

Run:

```bash
git add fitme-sportswear-backend/src/modules/products/inventory-sync.service.ts
git commit -m "$(cat <<'EOF'
Add inventory sync service

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 7: Add product sync orchestrator and module

**Files:**
- Create: `src/modules/products/product-sync-orchestrator.service.ts`
- Create: `src/modules/products/product-sync-orchestrator.service.spec.ts`
- Create: `src/modules/products/products.module.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Create `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.spec.ts`:

```ts
import { ProductSyncOrchestratorService } from './product-sync-orchestrator.service';

const mapping = {
  sku: 'SKU-1',
  sapo: {
    platform: 'sapo' as const,
    sku: 'SKU-1',
    productId: 'sapo-product',
    variantId: 'sapo-variant',
    name: 'Sapo Product',
    available: 8,
    remain: 8,
    retailPrice: 100000,
    warehouseId: null,
  },
  pancake: null,
  shopify: null,
  status: 'partial' as const,
  conflictReason: 'Missing Pancake and Shopify records',
};

describe('ProductSyncOrchestratorService', () => {
  it('runs snapshot, matching, mapping persistence, and inventory sync', async () => {
    const prisma = {
      productMapping: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      syncRun: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const snapshots = [{ ...mapping.sapo }];
    const snapshotService = { refreshAllSnapshots: jest.fn().mockResolvedValue(snapshots) };
    const matchingService = { buildMappings: jest.fn().mockReturnValue([mapping]) };
    const inventorySyncService = { syncMappings: jest.fn().mockResolvedValue({ updatedPancake: 0, updatedShopify: 0, errors: [] }) };
    const service = new ProductSyncOrchestratorService(prisma as never, snapshotService as never, matchingService as never, inventorySyncService as never);

    await service.run('sync-run-1');

    expect(snapshotService.refreshAllSnapshots).toHaveBeenCalled();
    expect(matchingService.buildMappings).toHaveBeenCalledWith(snapshots);
    expect(prisma.productMapping.upsert).toHaveBeenCalledWith({
      where: { sku: 'SKU-1' },
      create: expect.objectContaining({ sku: 'SKU-1', status: 'partial' }),
      update: expect.objectContaining({ status: 'partial' }),
    });
    expect(inventorySyncService.syncMappings).toHaveBeenCalledWith([mapping]);
    expect(prisma.syncRun.update).toHaveBeenLastCalledWith({
      where: { id: 'sync-run-1' },
      data: expect.objectContaining({ status: 'succeeded', finishedAt: expect.any(Date) }),
    });
  });
});
```

- [ ] **Step 2: Run orchestrator test to verify failure**

Run:

```bash
cd fitme-sportswear-backend && npm test -- product-sync-orchestrator.service.spec.ts --runInBand
```

Expected: FAIL because orchestrator file does not exist.

- [ ] **Step 3: Implement orchestrator**

Create `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ProductMappingStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';
import { ProductMappingCandidate } from './types/platform-product-snapshot';

@Injectable()
export class ProductSyncOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotService: ProductSnapshotService,
    private readonly matchingService: ProductMatchingService,
    private readonly inventorySyncService: InventorySyncService,
  ) {}

  async run(syncRunId: string) {
    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      const snapshots = await this.snapshotService.refreshAllSnapshots();
      const mappings = this.matchingService.buildMappings(snapshots);

      for (const mapping of mappings) {
        await this.upsertMapping(mapping);
      }

      const inventoryResult = await this.inventorySyncService.syncMappings(mappings);

      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          metadata: {
            snapshots: snapshots.length,
            mappings: mappings.length,
            matched: mappings.filter((mapping) => mapping.status === 'matched').length,
            partial: mappings.filter((mapping) => mapping.status === 'partial').length,
            conflict: mappings.filter((mapping) => mapping.status === 'conflict').length,
            updatedPancake: inventoryResult.updatedPancake,
            updatedShopify: inventoryResult.updatedShopify,
            errors: inventoryResult.errors,
          },
        },
      });
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown product sync error',
        },
      });
      throw error;
    }
  }

  private async upsertMapping(mapping: ProductMappingCandidate) {
    const data = {
      sapoProductId: mapping.sapo?.productId ?? null,
      sapoVariantId: mapping.sapo?.variantId ?? null,
      pancakeProductId: mapping.pancake?.productId ?? null,
      pancakeVariantId: mapping.pancake?.variantId ?? null,
      pancakeWarehouseId: mapping.pancake?.warehouseId ?? null,
      shopifyProductId: mapping.shopify?.productId ?? null,
      shopifyVariantId: mapping.shopify?.variantId ?? null,
      status: mapping.status as ProductMappingStatus,
      conflictReason: mapping.conflictReason,
    };

    await this.prisma.productMapping.upsert({
      where: { sku: mapping.sku },
      create: { sku: mapping.sku, ...data },
      update: data,
    });
  }
}
```

- [ ] **Step 4: Add products module**

Create `fitme-sportswear-backend/src/modules/products/products.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PancakeModule } from '../pancake/pancake.module';
import { SapoModule } from '../sapo/sapo.module';
import { ShopifyModule } from '../shopify/shopify.module';
import { InventorySyncService } from './inventory-sync.service';
import { ProductMatchingService } from './product-matching.service';
import { ProductSnapshotService } from './product-snapshot.service';
import { ProductSyncOrchestratorService } from './product-sync-orchestrator.service';

@Module({
  imports: [SapoModule, PancakeModule, ShopifyModule],
  providers: [ProductSnapshotService, ProductMatchingService, InventorySyncService, ProductSyncOrchestratorService],
  exports: [ProductSyncOrchestratorService],
})
export class ProductsModule {}
```

- [ ] **Step 5: Run orchestrator tests**

Run:

```bash
cd fitme-sportswear-backend && npm test -- product-sync-orchestrator.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit orchestrator and module**

Run:

```bash
git add fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.ts fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.spec.ts fitme-sportswear-backend/src/modules/products/products.module.ts
git commit -m "$(cat <<'EOF'
Add product sync orchestrator

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 8: Wire BullMQ product sync job

**Files:**
- Modify: `src/modules/queue/queue.constants.ts`
- Create: `src/modules/queue/producers/product-sync.producer.ts`
- Create: `src/modules/queue/processors/product-sync.processor.ts`
- Modify: `src/modules/queue/queue.module.ts`

- [ ] **Step 1: Extend queue constants**

Modify `fitme-sportswear-backend/src/modules/queue/queue.constants.ts` to:

```ts
export const TEST_SYNC_QUEUE = 'test-sync';
export const TEST_SYNC_JOB = 'test-sync.run';

export const PRODUCT_SYNC_QUEUE = 'product-sync';
export const PRODUCT_SYNC_JOB = 'product-sync.run';
```

- [ ] **Step 2: Add product sync producer**

Create `fitme-sportswear-backend/src/modules/queue/producers/product-sync.producer.ts`:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PRODUCT_SYNC_JOB, PRODUCT_SYNC_QUEUE } from '../queue.constants';

export interface ProductSyncPayload {
  syncRunId: string;
}

@Injectable()
export class ProductSyncProducer {
  constructor(@InjectQueue(PRODUCT_SYNC_QUEUE) private readonly queue: Queue<ProductSyncPayload>) {}

  async enqueue(payload: ProductSyncPayload) {
    return this.queue.add(PRODUCT_SYNC_JOB, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }
}
```

- [ ] **Step 3: Add product sync processor**

Create `fitme-sportswear-backend/src/modules/queue/processors/product-sync.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProductSyncOrchestratorService } from '../../products/product-sync-orchestrator.service';
import { ProductSyncPayload } from '../producers/product-sync.producer';
import { PRODUCT_SYNC_QUEUE } from '../queue.constants';

@Processor(PRODUCT_SYNC_QUEUE, { concurrency: 1 })
export class ProductSyncProcessor extends WorkerHost {
  constructor(private readonly orchestrator: ProductSyncOrchestratorService) {
    super();
  }

  async process(job: Job<ProductSyncPayload>) {
    await this.orchestrator.run(job.data.syncRunId);
  }
}
```

- [ ] **Step 4: Wire queue module**

Modify `fitme-sportswear-backend/src/modules/queue/queue.module.ts` to:

```ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsModule } from '../products/products.module';
import { ProductSyncProcessor } from './processors/product-sync.processor';
import { TestSyncProcessor } from './processors/test-sync.processor';
import { ProductSyncProducer } from './producers/product-sync.producer';
import { TestSyncProducer } from './producers/test-sync.producer';
import { PRODUCT_SYNC_QUEUE, TEST_SYNC_QUEUE } from './queue.constants';

@Module({
  imports: [
    ProductsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
        },
      }),
    }),
    BullModule.registerQueue({ name: TEST_SYNC_QUEUE }, { name: PRODUCT_SYNC_QUEUE }),
  ],
  providers: [TestSyncProducer, TestSyncProcessor, ProductSyncProducer, ProductSyncProcessor],
  exports: [TestSyncProducer, ProductSyncProducer],
})
export class QueueModule {}
```

- [ ] **Step 5: Run build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit queue wiring**

Run:

```bash
git add fitme-sportswear-backend/src/modules/queue/queue.constants.ts fitme-sportswear-backend/src/modules/queue/producers/product-sync.producer.ts fitme-sportswear-backend/src/modules/queue/processors/product-sync.processor.ts fitme-sportswear-backend/src/modules/queue/queue.module.ts
git commit -m "$(cat <<'EOF'
Wire product sync queue

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 9: Add sync API endpoints

**Files:**
- Modify: `src/modules/sync/sync.service.ts`
- Modify: `src/modules/sync/sync.controller.ts`

- [ ] **Step 1: Modify sync service**

Modify `fitme-sportswear-backend/src/modules/sync/sync.service.ts` to:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ProductSyncProducer } from '../queue/producers/product-sync.producer';
import { TestSyncProducer } from '../queue/producers/test-sync.producer';

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testSyncProducer: TestSyncProducer,
    private readonly productSyncProducer: ProductSyncProducer,
  ) {}

  async createTestSync(message = 'test sync') {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'test-sync',
        status: 'queued',
        metadata: { message },
      },
    });

    await this.testSyncProducer.enqueue({ syncRunId: syncRun.id, message });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async getTestSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (!syncRun || syncRun.syncType !== 'test-sync') {
      throw new NotFoundException('Test sync run not found');
    }

    return syncRun;
  }

  async createProductSync() {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        syncType: 'product-inventory-sync',
        status: 'queued',
        metadata: {},
      },
    });

    await this.productSyncProducer.enqueue({ syncRunId: syncRun.id });

    return {
      id: syncRun.id,
      status: syncRun.status,
      syncType: syncRun.syncType,
    };
  }

  async getProductSync(id: string) {
    const syncRun = await this.prisma.syncRun.findUnique({ where: { id } });

    if (!syncRun || syncRun.syncType !== 'product-inventory-sync') {
      throw new NotFoundException('Product sync run not found');
    }

    return syncRun;
  }
}
```

- [ ] **Step 2: Modify sync controller**

Modify `fitme-sportswear-backend/src/modules/sync/sync.controller.ts` to:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateTestSyncDto } from './dto/create-test-sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('test')
  createTestSync(@Body() dto: CreateTestSyncDto) {
    return this.syncService.createTestSync(dto.message);
  }

  @Get('test/:id')
  getTestSync(@Param('id') id: string) {
    return this.syncService.getTestSync(id);
  }

  @Post('products')
  createProductSync() {
    return this.syncService.createProductSync();
  }

  @Get('products/:id')
  getProductSync(@Param('id') id: string) {
    return this.syncService.getProductSync(id);
  }
}
```

- [ ] **Step 3: Run build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit sync endpoints**

Run:

```bash
git add fitme-sportswear-backend/src/modules/sync/sync.service.ts fitme-sportswear-backend/src/modules/sync/sync.controller.ts
git commit -m "$(cat <<'EOF'
Expose product sync endpoints

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds.

---

### Task 10: Register products module in app and finalize verification

**Files:**
- Modify: `src/app.module.ts`
- Optional Modify: `.env.example`

- [ ] **Step 1: Register ProductsModule if build requires it**

If `ProductsModule` is only imported through `QueueModule`, no change is required. If dependency resolution fails or the app should expose product providers directly later, modify `fitme-sportswear-backend/src/app.module.ts` to include it:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './modules/config/app-config.module';
import { DatabaseModule } from './modules/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { PancakeModule } from './modules/pancake/pancake.module';
import { ProductsModule } from './modules/products/products.module';
import { QueueModule } from './modules/queue/queue.module';
import { SapoModule } from './modules/sapo/sapo.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { SyncModule } from './modules/sync/sync.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    HealthModule,
    QueueModule,
    SapoModule,
    PancakeModule,
    ShopifyModule,
    ProductsModule,
    SyncModule,
    WebhookModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Run all unit tests**

Run:

```bash
cd fitme-sportswear-backend && npm test -- --runInBand
```

Expected: PASS for mapper, matching, and orchestrator specs.

- [ ] **Step 3: Run build**

Run:

```bash
cd fitme-sportswear-backend && npm run build
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
cd fitme-sportswear-backend && npm run lint
```

Expected: PASS. If ESLint reports existing repository setup issues unrelated to these changes, record the exact failure before deciding whether to fix it in this branch.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: Only intended files are modified. Do not stage `.superpowers/` or `.claude/worktrees/`.

- [ ] **Step 6: Commit final wiring if there are changes**

Run:

```bash
git add fitme-sportswear-backend/src/app.module.ts fitme-sportswear-backend/.env.example
git commit -m "$(cat <<'EOF'
Finalize product sync wiring

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit succeeds if files changed. If neither file changed, skip this commit.

---

## Self-Review

Spec coverage:

- Snapshot tables and mapping table are covered in Task 1.
- Sapo/Pancake/Shopify snapshot mapping is covered in Task 2.
- SKU matching, partial mapping, and duplicate conflict behavior are covered in Task 3.
- Platform client contracts are covered in Task 4.
- Snapshot fetch/upsert is covered in Task 5.
- Inventory and price sync from Sapo to receiving platforms is covered in Task 6.
- SyncRun metadata and orchestration are covered in Task 7.
- BullMQ job execution is covered in Task 8.
- API entry points are covered in Task 9.
- Full verification is covered in Task 10.

Placeholder scan:

- The plan contains no TBD markers.
- Client API methods intentionally return no-op data in this phase because concrete HTTP integration requires platform endpoint details and is isolated behind explicit contracts.
- The plan does not include auto-create product behavior.

Type consistency:

- Snapshot type names match across mapper, matching, snapshot, inventory, and orchestrator services.
- Queue constant names match producer and processor.
- Sync type string is consistently `product-inventory-sync`.
