# Pancake Composite Combo Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-mcp-augment:subagent-driven-development (recommended) or superpowers-mcp-augment:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create new Sapo combo SKUs on Pancake as true composite products using component variation IDs, not as ordinary inventory-managed products.

**Architecture:** Extend combo SKU parsing so the system can resolve the two component SKUs. Add a Pancake client method for `update_composite_product`, then change Sapo-to-Pancake inventory creation to create the combo variation and immediately configure it as composite only when both component variations already exist on Pancake. Keep ordinary SKU creation unchanged and keep legacy product sync from creating combo products as ordinary Pancake products.

**Tech Stack:** TypeScript, NestJS, Jest, Prisma, Pancake REST API

---

### Task 1: Parse Combo SKU Components

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/combo-sku.ts`
- Modify: `fitme-sportswear-backend/src/modules/products/combo-sku.spec.ts`

- [ ] **Step 1: Add failing parse tests**

```typescript
import { getComboSkuComponents, isComboSku } from './combo-sku';

describe('getComboSkuComponents', () => {
  it('splits a two-component Fitme combo SKU', () => {
    expect(getComboSkuComponents('FM-AVBNU-XR-S-FM-QNTG01-DE-S')).toEqual([
      { sku: 'FM-AVBNU-XR-S', quantity: 1 },
      { sku: 'FM-QNTG01-DE-S', quantity: 1 },
    ]);
  });

  it('normalizes before splitting', () => {
    expect(getComboSkuComponents(' fm-avbnu-xr-s-fm-qntg01-de-s ')).toEqual([
      { sku: 'FM-AVBNU-XR-S', quantity: 1 },
      { sku: 'FM-QNTG01-DE-S', quantity: 1 },
    ]);
  });

  it.each(['FM-ATSO01-DO-L', 'VV-DXSP01-TR-M', 'FM-A-FM-B-FM-C', ''])(
    'returns null for malformed or non-combo SKU %s',
    (sku) => {
      expect(getComboSkuComponents(sku)).toBeNull();
    },
  );
});

describe('isComboSku', () => {
  it('matches parseable two-component combo SKUs', () => {
    expect(isComboSku('FM-AVBNU-XR-S-FM-QNTG01-DE-S')).toBe(true);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
cd fitme-sportswear-backend
npm test -- combo-sku --runInBand
```

Expected: FAIL because `getComboSkuComponents` does not exist.

- [ ] **Step 3: Implement parser**

```typescript
import { normalizeSku } from './sku-normalizer';

export interface ComboSkuComponent {
  sku: string;
  quantity: number;
}

export const getComboSkuComponents = (
  sku: string,
): ComboSkuComponent[] | null => {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku.startsWith('FM-')) {
    return null;
  }

  const marker = '-FM-';
  const markerIndex = normalizedSku.indexOf(marker, 3);
  if (markerIndex < 0 || normalizedSku.indexOf(marker, markerIndex + marker.length) >= 0) {
    return null;
  }

  const firstSku = normalizedSku.slice(0, markerIndex);
  const secondSku = normalizedSku.slice(markerIndex + 1);
  if (!firstSku || !secondSku.startsWith('FM-')) {
    return null;
  }

  return [
    { sku: firstSku, quantity: 1 },
    { sku: secondSku, quantity: 1 },
  ];
};

export const isComboSku = (sku: string): boolean =>
  getComboSkuComponents(sku) !== null;
```

- [ ] **Step 4: Run GREEN**

```bash
npm test -- combo-sku --runInBand
```

Expected: PASS.

### Task 2: Add Pancake Composite Client API

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/pancake/pancake.client.ts`
- Modify: `fitme-sportswear-backend/src/modules/pancake/pancake.client.spec.ts`

- [ ] **Step 1: Add failing client tests**

Add tests proving:

```typescript
await createClient().updateCompositeProduct({
  comboVariantId: 'combo-variant-1',
  components: [
    { variationId: 'component-1', quantity: 1 },
    { variationId: 'component-2', quantity: 1 },
  ],
});
```

calls:

```typescript
expect(fetchMock).toHaveBeenCalledWith(
  'https://pos.pages.fm/api/v1/shops/shop-1/variations/update_composite_product?api_key=pancake-key',
  expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      variation_id: 'combo-variant-1',
      composite_products: [
        { variation_id: 'component-1', quantity: 1 },
        { variation_id: 'component-2', quantity: 1 },
      ],
    }),
  }),
);
```

Also test non-2xx response throws:

```typescript
await expect(
  createClient().updateCompositeProduct({
    comboVariantId: 'combo-variant-1',
    components: [{ variationId: 'component-1', quantity: 1 }],
  }),
).rejects.toThrow('Pancake composite product update failed with status 422');
```

- [ ] **Step 2: Run RED**

```bash
npm test -- pancake.client --runInBand
```

Expected: FAIL because `updateCompositeProduct` does not exist.

- [ ] **Step 3: Implement method**

```typescript
async updateCompositeProduct(input: {
  comboVariantId: string;
  components: Array<{ variationId: string; quantity: number }>;
}): Promise<void> {
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
```

- [ ] **Step 4: Run GREEN**

```bash
npm test -- pancake.client --runInBand
```

Expected: PASS.

### Task 3: Create Composite Combo In Sapo-To-Pancake Inventory Sync

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts`

- [ ] **Step 1: Add failing composite creation test**

Use mappings for:

- combo: `FM-AVBNU-XR-S-FM-QNTG01-DE-S`, missing Pancake, recent Sapo updatedAt.
- component 1: `FM-AVBNU-XR-S`, exists on Pancake with `variantId='component-variant-1'`.
- component 2: `FM-QNTG01-DE-S`, exists on Pancake with `variantId='component-variant-2'`.

Assert:

```typescript
expect(result.createdCompositePancake).toBe(1);
expect(result.createdCompositePancakeSkus).toEqual([
  'FM-AVBNU-XR-S-FM-QNTG01-DE-S',
]);
expect(result.createdMissingPancake).toBe(0);
expect(pancakeClient.createProductFromSapo).toHaveBeenCalledWith({
  sku: 'FM-AVBNU-XR-S-FM-QNTG01-DE-S',
  name: 'Product',
  available: 0,
  retailPrice: 100,
});
expect(pancakeClient.updateCompositeProduct).toHaveBeenCalledWith({
  comboVariantId: 'created-pancake-variant',
  components: [
    { variationId: 'component-variant-1', quantity: 1 },
    { variationId: 'component-variant-2', quantity: 1 },
  ],
});
expect(pancakeClient.updateInventory).not.toHaveBeenCalledWith(
  expect.objectContaining({ variantId: 'created-pancake-variant' }),
);
```

- [ ] **Step 2: Add failing missing-component skip test**

Combo has only one component present on Pancake. Assert:

```typescript
expect(result.createdCompositePancake).toBe(0);
expect(result.skippedCompositeMissingComponents).toBe(1);
expect(result.skippedCompositeMissingComponentSkus).toEqual([
  {
    sku: 'FM-AVBNU-XR-S-FM-QNTG01-DE-S',
    missingComponents: ['FM-QNTG01-DE-S'],
  },
]);
expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
expect(pancakeClient.updateCompositeProduct).not.toHaveBeenCalled();
```

- [ ] **Step 3: Run RED**

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: FAIL because composite creation metadata/method calls do not exist.

- [ ] **Step 4: Implement metadata and combo branch**

Extend result metadata:

```typescript
createdCompositePancake: number;
createdCompositePancakeSkus: string[];
skippedCompositeMissingComponents: number;
skippedCompositeMissingComponentSkus: Array<{
  sku: string;
  missingComponents: string[];
}>;
```

When `mapping.pancake` is missing and `getComboSkuComponents(mapping.normalizedSku)` returns components:

1. Resolve component Pancake variants from the full mapping list.
2. If any component variant is missing, increment skip metadata and do not create.
3. If all exist, create the Pancake product with `available: 0`.
4. Call `updateCompositeProduct`.
5. Upsert local `pancake_products` and `product_mappings`.
6. Increment `createdCompositePancake`.
7. Do not call `updateInventory` for the combo variation.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: PASS.

### Task 4: Report Composite Create/Skip In Telegram Summary

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts`

- [ ] **Step 1: Add failing summary test**

Assert Telegram completion contains:

```typescript
expect(notifier.sendMessage).toHaveBeenCalledWith(
  'Sapo -> Pancake inventory sync completed',
  expect.stringContaining('createdCompositePancake=1'),
);
expect(notifier.sendMessage).toHaveBeenCalledWith(
  'Sapo -> Pancake inventory sync completed',
  expect.stringContaining(
    'createdCompositePancakeSkus=FM-AVBNU-XR-S-FM-QNTG01-DE-S',
  ),
);
expect(notifier.sendMessage).toHaveBeenCalledWith(
  'Sapo -> Pancake inventory sync completed',
  expect.stringContaining('skippedCompositeMissingComponents=0'),
);
```

- [ ] **Step 2: Run RED**

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: FAIL because summary lacks composite fields.

- [ ] **Step 3: Add summary fields**

Add lines:

```typescript
`createdCompositePancake=${result.createdCompositePancake}`,
`createdCompositePancakeSkus=${createdCompositePancakeSkus}`,
`skippedCompositeMissingComponents=${result.skippedCompositeMissingComponents}`,
`skippedCompositeMissingComponentSkus=${skippedCompositeMissingComponentSkus}`,
```

- [ ] **Step 4: Run GREEN**

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: PASS.

### Task 5: Verification And Runtime Safety

**Files:**
- No source edits expected.

- [ ] **Step 1: Run focused tests**

```bash
cd fitme-sportswear-backend
npm test -- combo-sku pancake.client sapo-to-pancake-inventory-sync inventory-sync --runInBand
```

Expected: all focused suites pass.

- [ ] **Step 2: Run full backend tests**

```bash
npm test -- --runInBand
```

Expected: all tests pass.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build pass.

- [ ] **Step 4: Confirm runtime remains stopped**

```bash
ps -ax | rg "node dist/main|node dist/worker|npm run start|npm run worker|cloudflared tunnel"
```

Expected: no backend/worker/tunnel processes.

- [ ] **Step 5: Diff check**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Working tree may include pre-existing unrelated changes; do not include them in a feature commit unless explicitly requested.
