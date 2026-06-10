# Combo SKU Auto-Create Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-mcp-augment:subagent-driven-development (recommended) or superpowers-mcp-augment:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent inventory reconciliation from auto-creating missing Pancake products for combo SKUs while preserving inventory sync for existing combo products and auto-create behavior for ordinary SKUs.

**Architecture:** Add a small pure SKU classifier that detects normalized combo SKUs by the second `-FM-` marker. Integrate it only into the missing-Pancake branch of `SapoToPancakeInventorySyncService`, then expose combo skips through sync metadata and Telegram completion summaries.

**Tech Stack:** TypeScript, NestJS, Jest, Prisma, Bull/Redis

---

### Task 1: Add A Pure Combo SKU Classifier

**Files:**
- Create: `fitme-sportswear-backend/src/modules/products/combo-sku.ts`
- Create: `fitme-sportswear-backend/src/modules/products/combo-sku.spec.ts`

- [ ] **Step 1: Write the failing classifier tests**

```typescript
import { isComboSku } from './combo-sku';

describe('isComboSku', () => {
  it.each([
    'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
    'FM-ATSO01-HP-L-FM-QDZT01-DE-XL',
  ])('detects Fitme combo SKU %s', (sku) => {
    expect(isComboSku(sku)).toBe(true);
  });

  it.each([
    'FM-ATSO01-DO-L',
    'FM-ATTL01-HP-XL',
    'VV-DXSP01-TR-M',
    '',
  ])('does not classify ordinary SKU %s as combo', (sku) => {
    expect(isComboSku(sku)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the classifier test and verify RED**

Run:

```bash
cd fitme-sportswear-backend
npm test -- combo-sku --runInBand
```

Expected: FAIL because `./combo-sku` does not exist.

- [ ] **Step 3: Implement the minimal classifier**

```typescript
import { normalizeSku } from './sku-normalizer';

export const isComboSku = (sku: string): boolean => {
  const normalizedSku = normalizeSku(sku);
  return normalizedSku.startsWith('FM-') && normalizedSku.includes('-FM-', 3);
};
```

- [ ] **Step 4: Run the classifier test and verify GREEN**

Run:

```bash
npm test -- combo-sku --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the classifier**

```bash
git add fitme-sportswear-backend/src/modules/products/combo-sku.ts fitme-sportswear-backend/src/modules/products/combo-sku.spec.ts
git commit -m "feat: detect combo SKUs"
```

### Task 2: Skip Auto-Creation For Missing Combo SKUs

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts`

- [ ] **Step 1: Write a failing missing-combo test**

Add a test that supplies a recent Sapo mapping with:

```typescript
{
  sku: 'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
  sapoAvailable: 12,
  pancakeAvailable: 0,
  updatedAt: new Date().toISOString(),
  missingPancake: true,
}
```

Assert:

```typescript
expect(result.createdMissingPancake).toBe(0);
expect(result.skippedComboCreate).toBe(1);
expect(result.skippedComboCreateSkus).toEqual([
  'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
]);
expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
expect(pancakeClient.updateInventory).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the service test and verify RED**

Run:

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: FAIL because combo skip metadata does not exist and the product is created.

- [ ] **Step 3: Add combo skip metadata and missing-product guard**

Import `isComboSku` and extend `SapoToPancakeInventorySyncResult`:

```typescript
skippedComboCreate: number;
skippedComboCreateSkus: string[];
```

Initialize both in `buildResult()`:

```typescript
skippedComboCreate: 0,
skippedComboCreateSkus: [],
```

In the missing-Pancake branch, before recent-product creation:

```typescript
if (isComboSku(mapping.normalizedSku)) {
  result.skippedComboCreate += 1;
  if (result.skippedComboCreateSkus.length < 20) {
    result.skippedComboCreateSkus.push(mapping.sku);
  }
} else if (
  !input.dryRun &&
  result.createdMissingPancake < missingPancakeCreateLimit &&
  this.shouldCreateRecentMissingPancake(mapping)
) {
  await this.createMissingPancakeProduct(mapping, result);
} else {
  result.skippedMissingPancake += 1;
}
```

- [ ] **Step 4: Run the service test and verify GREEN**

Run:

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit missing-combo protection**

```bash
git add fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts
git commit -m "feat: skip missing combo product creation"
```

### Task 3: Preserve Existing Combo Inventory Sync

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts`

- [ ] **Step 1: Add an existing-combo regression test**

Create a normal matched mapping for:

```typescript
{
  sku: 'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
  sapoAvailable: 12,
  pancakeAvailable: 3,
}
```

Assert:

```typescript
expect(result.updated).toBe(1);
expect(result.skippedComboCreate).toBe(0);
expect(pancakeClient.createProductFromSapo).not.toHaveBeenCalled();
expect(pancakeClient.updateInventory).toHaveBeenCalledWith({
  variantId: 'pancake-variant-1',
  warehouseId: 'warehouse-1',
  available: 12,
});
```

- [ ] **Step 2: Run the regression test**

Run:

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: PASS without production-code changes. If it fails, adjust only the missing-Pancake branch so existing combo variants continue through normal inventory candidate processing.

- [ ] **Step 3: Commit the regression coverage**

```bash
git add fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts
git commit -m "test: preserve existing combo inventory sync"
```

### Task 4: Report Combo Skips In Telegram Summary

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts`

- [ ] **Step 1: Write a failing Telegram summary test**

Run a real sync with one missing combo mapping and assert:

```typescript
expect(notifier.sendMessage).toHaveBeenCalledWith(
  'Sapo -> Pancake inventory sync completed',
  expect.stringContaining('skippedComboCreate=1'),
);
expect(notifier.sendMessage).toHaveBeenCalledWith(
  'Sapo -> Pancake inventory sync completed',
  expect.stringContaining(
    'skippedComboCreateSkus=FM-ATSO01-DO-L-FM-VSFM01-TR-L',
  ),
);
expect(notifier.sendMessage).not.toHaveBeenCalledWith(
  'Sapo -> Pancake inventory sync completed with errors',
  expect.any(String),
);
```

- [ ] **Step 2: Run the service test and verify RED**

Run:

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: FAIL because the Telegram summary omits combo skip metadata.

- [ ] **Step 3: Add combo skip information to `sendCompletionSummary()`**

Build the display value:

```typescript
const skippedComboCreateSkus =
  result.skippedComboCreateSkus.length > 0
    ? result.skippedComboCreateSkus.join(', ')
    : 'none';
```

Add these summary lines:

```typescript
`skippedComboCreate=${result.skippedComboCreate}`,
`skippedComboCreateSkus=${skippedComboCreateSkus}`,
```

- [ ] **Step 4: Run the service test and verify GREEN**

Run:

```bash
npm test -- sapo-to-pancake-inventory-sync.service --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit reporting**

```bash
git add fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts
git commit -m "feat: report skipped combo product creation"
```

### Task 5: Verify The Backend And Runtime Safety

**Files:**
- No source changes expected

- [ ] **Step 1: Run focused product sync tests**

```bash
cd fitme-sportswear-backend
npm test -- combo-sku sapo-to-pancake-inventory-sync pancake.client --runInBand
```

Expected: all suites PASS.

- [ ] **Step 2: Build the backend**

```bash
npm run build
```

Expected: NestJS build exits successfully.

- [ ] **Step 3: Confirm backend processes remain stopped**

```bash
ps -ax | rg "node dist/main|node dist/worker|npm run start|npm run worker|cloudflared tunnel"
```

Expected: no backend, worker, or tunnel processes.

- [ ] **Step 4: Review the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended implementation files plus pre-existing unrelated working-tree changes.

- [ ] **Step 5: Commit final verification fixes only if needed**

If verification required a small correction, commit only the files changed for
this feature:

```bash
git add fitme-sportswear-backend/src/modules/products/combo-sku.ts fitme-sportswear-backend/src/modules/products/combo-sku.spec.ts fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.ts fitme-sportswear-backend/src/modules/products/sapo-to-pancake-inventory-sync.service.spec.ts
git commit -m "fix: finalize combo SKU creation guard"
```
