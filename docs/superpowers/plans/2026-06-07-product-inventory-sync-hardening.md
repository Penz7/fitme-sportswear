# Product Inventory Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-mcp-augment:subagent-driven-development (recommended) or superpowers-mcp-augment:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Sapo-to-Pancake product and inventory sync so Sapo remains the only product inventory source, ambiguous SKUs are blocked, missing Pancake products are created idempotently, and SKU conflicts alert Telegram without spam.

**Architecture:** Product snapshots keep original SKU values and add a normalized SKU used only for matching and persistence keys. Product matching emits structured conflict metadata for duplicate Sapo/Pancake SKUs and ambiguous existing mappings. The orchestrator persists conflict records and sends first-seen Telegram alerts; the inventory service only updates/creates Pancake from Sapo and skips conflict mappings.

**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, Jest, existing TelegramNotifierService.

---

### Task 1: Add Normalized SKU And Conflict Types

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/types/platform-product-snapshot.ts`
- Create: `fitme-sportswear-backend/src/modules/products/sku-normalizer.ts`
- Test: `fitme-sportswear-backend/src/modules/products/sku-normalizer.spec.ts`

- [ ] **Step 1: Write the failing SKU normalizer tests**

```ts
import { normalizeSku } from './sku-normalizer';

describe('normalizeSku', () => {
  it('trims and uppercases SKU for matching', () => {
    expect(normalizeSku(' abc-123 ')).toBe('ABC-123');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeSku('AB  12\tCD')).toBe('AB 12 CD');
  });

  it('returns empty string for whitespace-only SKU', () => {
    expect(normalizeSku('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `cd fitme-sportswear-backend && npm test -- sku-normalizer.spec.ts --runInBand`

Expected: FAIL because `sku-normalizer.ts` does not exist.

- [ ] **Step 3: Implement the SKU normalizer**

```ts
export const normalizeSku = (sku: string | null | undefined): string =>
  String(sku ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
```

- [ ] **Step 4: Extend product snapshot and mapping types**

Add these fields/types in `platform-product-snapshot.ts`:

```ts
export type ProductConflictType =
  | 'duplicate_sapo_sku'
  | 'duplicate_pancake_sku'
  | 'duplicate_shopify_sku'
  | 'ambiguous_mapping'
  | 'multiple_pancake_warehouses';

export interface ProductConflictDetail {
  type: ProductConflictType;
  platform: ProductPlatform | 'mapping';
  message: string;
  sapoVariantCount: number;
  pancakeVariantCount: number;
  shopifyVariantCount: number;
  entries: Array<{
    platform: ProductPlatform;
    sku: string;
    productId: string | null;
    variantId: string | null;
    warehouseId: string | null;
    name: string | null;
  }>;
}
```

Update `PlatformProductSnapshot`:

```ts
normalizedSku: string;
```

Update `ProductMappingCandidate`:

```ts
normalizedSku: string;
conflictDetail: ProductConflictDetail | null;
```

- [ ] **Step 5: Run the new test and verify it passes**

Run: `cd fitme-sportswear-backend && npm test -- sku-normalizer.spec.ts --runInBand`

Expected: PASS.

### Task 2: Populate Normalized SKU In Snapshots

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.ts`
- Test: `fitme-sportswear-backend/src/modules/products/product-snapshot.mapper.spec.ts`

- [ ] **Step 1: Update existing mapper tests to expect normalizedSku**

For Sapo, Pancake, and Shopify expectations, add:

```ts
normalizedSku: 'SKU-1'
```

Use lowercase/space input in one test:

```ts
sku: ' sku-1 '
```

Expected normalized output:

```ts
normalizedSku: 'SKU-1'
```

- [ ] **Step 2: Run mapper tests and verify they fail**

Run: `cd fitme-sportswear-backend && npm test -- product-snapshot.mapper.spec.ts --runInBand`

Expected: FAIL because mappers do not populate `normalizedSku`.

- [ ] **Step 3: Update mappers**

Import:

```ts
import { normalizeSku } from './sku-normalizer';
```

For each mapped snapshot, add:

```ts
normalizedSku: normalizeSku(sku),
```

Keep existing `sku` unchanged except for the current trim behavior already used by the mapper.

- [ ] **Step 4: Run mapper tests and verify they pass**

Run: `cd fitme-sportswear-backend && npm test -- product-snapshot.mapper.spec.ts --runInBand`

Expected: PASS.

### Task 3: Detect Conflicts By Normalized SKU

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/product-matching.service.ts`
- Test: `fitme-sportswear-backend/src/modules/products/product-matching.service.spec.ts`

- [ ] **Step 1: Update matching tests for normalized matching**

Add this test:

```ts
it('matches SKU case-insensitively using normalizedSku', () => {
  const sapo = snapshot('sapo', ' abc-1 ');
  sapo.normalizedSku = 'ABC-1';
  const pancake = snapshot('pancake', 'ABC-1');
  pancake.normalizedSku = 'ABC-1';

  const result = service.buildMappings([sapo, pancake]);

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    sku: 'abc-1',
    normalizedSku: 'ABC-1',
    status: 'matched',
  });
});
```

Update `snapshot()` helper to include:

```ts
normalizedSku: sku.trim().toUpperCase(),
```

- [ ] **Step 2: Add conflict detail tests**

Add tests for duplicate Sapo and Pancake SKUs:

```ts
it('marks duplicate Sapo normalized SKU as duplicate_sapo_sku conflict', () => {
  const one = snapshot('sapo', 'SKU-6');
  one.productId = 'sapo-product-1';
  one.variantId = 'sapo-variant-1';
  const two = snapshot('sapo', ' sku-6 ');
  two.normalizedSku = 'SKU-6';
  two.productId = 'sapo-product-2';
  two.variantId = 'sapo-variant-2';

  const result = service.buildMappings([one, two, snapshot('pancake', 'SKU-6')]);

  expect(result[0].status).toBe('conflict');
  expect(result[0].conflictDetail).toMatchObject({
    type: 'duplicate_sapo_sku',
    platform: 'sapo',
    sapoVariantCount: 2,
    pancakeVariantCount: 1,
  });
});

it('marks duplicate Pancake normalized SKU as duplicate_pancake_sku conflict', () => {
  const one = snapshot('pancake', 'SKU-7');
  one.productId = 'pancake-product-1';
  one.variantId = 'pancake-variant-1';
  const two = snapshot('pancake', ' sku-7 ');
  two.normalizedSku = 'SKU-7';
  two.productId = 'pancake-product-2';
  two.variantId = 'pancake-variant-2';

  const result = service.buildMappings([snapshot('sapo', 'SKU-7'), one, two]);

  expect(result[0].status).toBe('conflict');
  expect(result[0].conflictDetail).toMatchObject({
    type: 'duplicate_pancake_sku',
    platform: 'pancake',
    sapoVariantCount: 1,
    pancakeVariantCount: 2,
  });
});
```

- [ ] **Step 3: Run matching tests and verify they fail**

Run: `cd fitme-sportswear-backend && npm test -- product-matching.service.spec.ts --runInBand`

Expected: FAIL because matching still groups by raw SKU and does not emit `conflictDetail`.

- [ ] **Step 4: Update matching implementation**

Use `snapshot.normalizedSku` as the map key:

```ts
const key = snapshot.normalizedSku;
```

Choose display `sku` in this priority:

```ts
const sku = sapo?.sku ?? pancake?.sku ?? shopify?.sku ?? normalizedSku;
```

When duplicate platform is found, create `conflictDetail`:

```ts
{
  type: duplicatePlatform === 'sapo'
    ? 'duplicate_sapo_sku'
    : duplicatePlatform === 'pancake'
      ? 'duplicate_pancake_sku'
      : 'duplicate_shopify_sku',
  platform: duplicatePlatform,
  message: `Duplicate normalized SKU in ${duplicatePlatform}`,
  sapoVariantCount: entries.filter((entry) => entry.platform === 'sapo').length,
  pancakeVariantCount: entries.filter((entry) => entry.platform === 'pancake').length,
  shopifyVariantCount: entries.filter((entry) => entry.platform === 'shopify').length,
  entries: entries.map((entry) => ({
    platform: entry.platform,
    sku: entry.sku,
    productId: entry.productId,
    variantId: entry.variantId,
    warehouseId: entry.warehouseId,
    name: entry.name,
  })),
}
```

For existing multi-warehouse Pancake conflict, set type `multiple_pancake_warehouses`.

- [ ] **Step 5: Run matching tests and verify they pass**

Run: `cd fitme-sportswear-backend && npm test -- product-matching.service.spec.ts --runInBand`

Expected: PASS.

### Task 4: Persist Conflict Records And Avoid Telegram Spam

**Files:**
- Modify: `fitme-sportswear-backend/prisma/schema.prisma`
- Create: `fitme-sportswear-backend/prisma/migrations/20260607000000_product_sync_conflicts/migration.sql`
- Modify: `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.ts`
- Test: `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.spec.ts`

- [ ] **Step 1: Add Prisma model**

Add below `ProductMapping`:

```prisma
model ProductSyncConflict {
  id                 String    @id @default(uuid())
  normalizedSku      String
  conflictType       String
  platform           String
  originalSkus       Json
  involvedEntities   Json
  message            String
  firstSeenAt        DateTime  @default(now())
  lastSeenAt         DateTime  @updatedAt
  resolvedAt         DateTime?
  lastNotifiedAt     DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  @@unique([normalizedSku, conflictType, platform])
  @@index([resolvedAt])
  @@map("product_sync_conflicts")
}
```

- [ ] **Step 2: Add SQL migration**

Create migration SQL:

```sql
CREATE TABLE "product_sync_conflicts" (
  "id" TEXT NOT NULL,
  "normalizedSku" TEXT NOT NULL,
  "conflictType" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "originalSkus" JSONB NOT NULL,
  "involvedEntities" JSONB NOT NULL,
  "message" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_sync_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_sync_conflicts_normalizedSku_conflictType_platform_key"
ON "product_sync_conflicts"("normalizedSku", "conflictType", "platform");

CREATE INDEX "product_sync_conflicts_resolvedAt_idx"
ON "product_sync_conflicts"("resolvedAt");
```

- [ ] **Step 3: Write orchestrator tests for conflict persistence and notification**

Add a test with `prisma.productSyncConflict.upsert` mocked to return a conflict with `lastNotifiedAt: null`, and assert:

```ts
expect(prisma.productSyncConflict.upsert).toHaveBeenCalledWith(expect.objectContaining({
  where: {
    normalizedSku_conflictType_platform: {
      normalizedSku: 'SKU-1',
      conflictType: 'duplicate_pancake_sku',
      platform: 'pancake',
    },
  },
}));

expect(notifier.sendMessage).toHaveBeenCalledWith(
  '[Fitme Sync] SKU conflict detected',
  expect.stringContaining('SKU: SKU-1'),
);

expect(prisma.productSyncConflict.update).toHaveBeenCalledWith({
  where: { id: 'conflict-1' },
  data: { lastNotifiedAt: expect.any(Date) },
});
```

Add a second test where `lastNotifiedAt` is already set, and assert no new conflict-specific Telegram message is sent.

- [ ] **Step 4: Run orchestrator tests and verify they fail**

Run: `cd fitme-sportswear-backend && npm test -- product-sync-orchestrator.service.spec.ts --runInBand`

Expected: FAIL because `productSyncConflict` persistence does not exist.

- [ ] **Step 5: Implement conflict persistence**

In `run()`, after mappings are built and before inventory sync:

```ts
await this.recordConflicts(mappings);
```

Implement:

```ts
private async recordConflicts(mappings: ProductMappingCandidate[]): Promise<void> {
  const conflictMappings = mappings.filter(
    (mapping) => mapping.status === 'conflict' && mapping.conflictDetail,
  );

  for (const mapping of conflictMappings) {
    await this.recordConflict(mapping);
  }
}
```

`recordConflict()` must:

- Upsert by `normalizedSku + conflictType + platform`.
- Set `resolvedAt: null`.
- Update `lastSeenAt` with current date.
- Preserve `firstSeenAt` by not setting it in update.
- Send Telegram only when returned record has no `lastNotifiedAt`.
- Catch Telegram errors and continue.

- [ ] **Step 6: Run orchestrator tests and verify they pass**

Run: `cd fitme-sportswear-backend && npm test -- product-sync-orchestrator.service.spec.ts --runInBand`

Expected: PASS.

### Task 5: Make Pancake Creation Idempotent And Sapo-Only

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/inventory-sync.service.ts`
- Test: `fitme-sportswear-backend/src/modules/products/inventory-sync.service.spec.ts`

- [ ] **Step 1: Add tests for Sapo-only product creation behavior**

Add a test where:

- mapping has Sapo only
- Prisma already has a Pancake product with same normalized/raw SKU
- service does not call `createProductFromSapo`
- service calls `updateInventory`
- product mapping is upserted with existing Pancake IDs

Use a mock:

```ts
prisma.pancakeProduct.findUnique = jest.fn().mockResolvedValue({
  sku: 'SKU-1',
  productId: 'pancake-product-1',
  variantId: 'pancake-variant-1',
  warehouseId: 'warehouse-1',
  available: 3,
});
```

Expected:

```ts
expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
  variantId: 'pancake-variant-1',
  warehouseId: 'warehouse-1',
  available: 7,
});
```

- [ ] **Step 2: Add test that conflict mappings never create or update Pancake**

Expected:

```ts
expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
```

- [ ] **Step 3: Run inventory tests and verify they fail**

Run: `cd fitme-sportswear-backend && npm test -- inventory-sync.service.spec.ts --runInBand`

Expected: FAIL because idempotent re-check is not implemented.

- [ ] **Step 4: Implement idempotent Pancake lookup before create**

Before `createProductFromSapo`, re-check:

```ts
const existingPancake = await this.prisma.pancakeProduct.findUnique({
  where: { sku: mapping.sku },
});
```

If existing Pancake product has `variantId`, call `updateInventory`, update DB, upsert mapping, increment `updatedPancake`, and skip create.

Do not add any code path that updates Sapo from Pancake.

- [ ] **Step 5: Run inventory tests and verify they pass**

Run: `cd fitme-sportswear-backend && npm test -- inventory-sync.service.spec.ts --runInBand`

Expected: PASS.

### Task 6: Verify Full Product Sync Suite

**Files:**
- No new files.

- [ ] **Step 1: Regenerate Prisma client after schema changes**

Run: `cd fitme-sportswear-backend && npx prisma generate`

Expected: Prisma client generated successfully.

- [ ] **Step 2: Run focused product tests**

Run: `cd fitme-sportswear-backend && npm test -- product --runInBand`

Expected: all product-related tests pass.

- [ ] **Step 3: Run full backend test suite**

Run: `cd fitme-sportswear-backend && npm test -- --runInBand`

Expected: all tests pass.

- [ ] **Step 4: Build backend**

Run: `cd fitme-sportswear-backend && npm run build`

Expected: TypeScript build succeeds.

- [ ] **Step 5: Confirm no runtime is started**

Run: `docker ps`

Expected: no backend containers are started by this implementation plan. This change is code-only until the user asks to run the system.

### Task 7: Commit Implementation

**Files:**
- Commit all implementation and test files from Tasks 1-6.

- [ ] **Step 1: Check git status**

Run: `git status --short`

Expected: implementation files, Prisma migration, and tests are modified; unrelated generated reports remain untouched unless already tracked.

- [ ] **Step 2: Commit code**

Run:

```bash
git add fitme-sportswear-backend/src/modules/products fitme-sportswear-backend/prisma/schema.prisma fitme-sportswear-backend/prisma/migrations/20260607000000_product_sync_conflicts
git commit -m "Harden product inventory sync conflicts"
```

Expected: commit succeeds.
