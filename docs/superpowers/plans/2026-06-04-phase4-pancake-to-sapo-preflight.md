# Phase 4 Pancake-to-Sapo Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed, read-only preflight for Pancake-to-Sapo order creation and prepare verified internal product/address mappings without creating any external order.

**Architecture:** Extract Pancake-to-Sapo payload construction and validation into a focused preflight service. The existing webhook executor will consume the validated payload instead of rebuilding permissive payloads. A sync endpoint will refresh only internal snapshots/mappings with external creation and inventory writes disabled, while a preflight endpoint reads a Pancake order and returns a redacted preview.

**Tech Stack:** NestJS, TypeScript, Jest, Prisma, Docker Compose

---

### Task 1: Validate Phase 4 configuration

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/config/configuration.ts`
- Modify: `fitme-sportswear-backend/src/modules/config/env.validation.ts`
- Modify: `fitme-sportswear-backend/.env.example`
- Test: `fitme-sportswear-backend/src/modules/config/env.validation.spec.ts`

- [ ] **Step 1: Write failing configuration tests**

Add tests proving configuration rejects:

```ts
{
  SAPO_PANCAKE_SOURCE_ID: undefined,
  PANCAKE_DEFAULT_WAREHOUSE_ID: undefined,
  SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID: 'not-json',
  SAPO_PREPAYMENT_METHOD_ID: undefined,
  SAPO_PREPAYMENT_METHOD_NAME: undefined,
}
```

Also test that the warehouse-location JSON must contain
`PANCAKE_DEFAULT_WAREHOUSE_ID`.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- env.validation.spec.ts --runInBand
```

Expected: FAIL because the Phase 4 variables are not validated or exposed.

- [ ] **Step 3: Implement validated configuration**

Expose:

```ts
sapo: {
  pancakeSourceId: Number(process.env.SAPO_PANCAKE_SOURCE_ID),
  prepaymentMethodId: Number(process.env.SAPO_PREPAYMENT_METHOD_ID),
  prepaymentMethodName: process.env.SAPO_PREPAYMENT_METHOD_NAME,
  locationIdByPancakeWarehouseId: JSON.parse(
    process.env.SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID!,
  ),
},
pancake: {
  defaultWarehouseId: process.env.PANCAKE_DEFAULT_WAREHOUSE_ID,
}
```

Validation must reject invalid numbers, invalid JSON, and a missing default
warehouse mapping. Do not provide fallback IDs.

- [ ] **Step 4: Update `.env.example` without secrets**

Add:

```dotenv
SAPO_PANCAKE_SOURCE_ID=
SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID={}
SAPO_PREPAYMENT_METHOD_ID=
SAPO_PREPAYMENT_METHOD_NAME=
PANCAKE_DEFAULT_WAREHOUSE_ID=
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm test -- env.validation.spec.ts --runInBand
```

Expected: PASS.

### Task 2: Build fail-closed Pancake-to-Sapo preflight service

**Files:**
- Create: `fitme-sportswear-backend/src/modules/orders/pancake-to-sapo-preflight.service.ts`
- Create: `fitme-sportswear-backend/src/modules/orders/pancake-to-sapo-preflight.service.spec.ts`
- Modify: `fitme-sportswear-backend/src/modules/orders/orders.module.ts`

- [ ] **Step 1: Write failing valid-payload test**

Create a test with a complete Pancake order and complete product mapping. Assert
the result contains:

```ts
{
  valid: true,
  sapoOrder: {
    code: 'AUTO_PANCAKE_pancake-order-1',
    source_id: 5632931,
    location_id: 572310,
    status: 'placed',
    shipping_address: {
      full_address: '...',
      ward: '...',
    },
    order_line_items: [
      {
        sku: 'SKU-1',
        quantity: 1,
        price: 150000,
        product_id: 'sapo-product-1',
        variant_id: 'sapo-variant-1',
      },
    ],
  },
}
```

- [ ] **Step 2: Write failing rejection tests**

Use `it.each` to prove rejection for:

- Missing order ID.
- Unknown warehouse.
- Missing customer name or phone.
- Missing total.
- Missing full address, province, district, commune, or their names.
- Empty items.
- Missing SKU, quantity, or price.
- Quantity less than or equal to zero.
- Missing Sapo product or variant mapping.
- Existing Pancake order mapping.

Assert all validation errors are returned together and no Sapo client write
method is called.

- [ ] **Step 3: Write failing numeric-null regression test**

Assert `null` total, quantity, price, or discount remains invalid/null and is
not converted to `0`.

- [ ] **Step 4: Run tests and verify RED**

Run:

```powershell
npm test -- pancake-to-sapo-preflight.service.spec.ts --runInBand
```

Expected: FAIL because the service does not exist.

- [ ] **Step 5: Implement the preflight service**

Implement:

```ts
export interface PancakeToSapoPreflightResult {
  valid: boolean;
  errors: string[];
  sapoOrder: Record<string, any> | null;
  prepayment: Record<string, any> | null;
  preview: Record<string, any>;
}
```

The service must:

- Load product and existing order mappings from Prisma.
- Resolve Sapo location only from the configured warehouse map.
- Use strict numeric parsing that returns `null` for `null`, `undefined`, and
  empty strings.
- Build a payload only when there are no errors.
- Build prepayment only for a positive Pancake prepaid amount.
- Redact customer name, phone, email, and street address in `preview`.
- Never call Sapo write methods.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm test -- pancake-to-sapo-preflight.service.spec.ts --runInBand
```

Expected: PASS.

### Task 3: Make webhook execution consume validated payloads

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/orders/order-webhook-execution.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/orders/order-webhook-execution.service.spec.ts`

- [ ] **Step 1: Write failing executor tests**

Add tests proving:

- Failed preflight throws before `sapoClient.createOrder`.
- Valid preflight passes the exact validated payload to `createOrder`.
- Prepayment uses configured method ID/name from preflight.
- Existing permissive `product_id/variant_id=null` behavior is rejected.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- order-webhook-execution.service.spec.ts --runInBand
```

Expected: FAIL because the executor still builds permissive payloads.

- [ ] **Step 3: Inject and use preflight service**

For `create_sapo_order`, call the preflight service first:

```ts
const preflight = await this.pancakeToSapoPreflightService.preflight(payload);
if (!preflight.valid || !preflight.sapoOrder) {
  throw new Error(`Pancake-to-Sapo preflight failed: ${preflight.errors.join('; ')}`);
}
```

Use `preflight.sapoOrder` and `preflight.prepayment` for Sapo writes. Remove
hardcoded source ID, prepayment method, and permissive line-item mapping from the
Pancake creation path.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- order-webhook-execution.service.spec.ts pancake-to-sapo-preflight.service.spec.ts --runInBand
```

Expected: PASS.

### Task 4: Add a read-only preflight endpoint

**Files:**
- Create: `fitme-sportswear-backend/src/modules/orders/order-preflight.controller.ts`
- Create: `fitme-sportswear-backend/src/modules/orders/order-preflight.controller.spec.ts`
- Modify: `fitme-sportswear-backend/src/modules/orders/orders.module.ts`

- [ ] **Step 1: Write failing endpoint tests**

Test:

```http
GET /orders/preflight/pancake/:orderId
```

Assert it:

- Calls `PancakeClient.fetchOrder(orderId)`.
- Passes the returned order body to the preflight service.
- Returns only `valid`, `errors`, and redacted `preview`.
- Never calls Sapo create/update/customer/prepayment methods.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- order-preflight.controller.spec.ts --runInBand
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement controller**

The controller must unwrap Pancake responses safely:

```ts
const response = await this.pancakeClient.fetchOrder(orderId);
const payload = response.data ?? response;
const result = await this.preflightService.preflight(payload);
return {
  valid: result.valid,
  errors: result.errors,
  preview: result.preview,
};
```

Do not expose unredacted payload or add an execute endpoint.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- order-preflight.controller.spec.ts --runInBand
```

Expected: PASS.

### Task 5: Make internal mapping sync safe and usable

**Files:**
- Modify: `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/products/product-sync-orchestrator.service.spec.ts`
- Modify: `fitme-sportswear-backend/src/modules/address/address-sync.service.ts`
- Modify: `fitme-sportswear-backend/src/modules/address/address-sync.service.spec.ts`

- [ ] **Step 1: Write failing mapping-only sync tests**

Add tests proving mapping-only mode:

- Refreshes Sapo and Pancake snapshots.
- Builds product mappings.
- Refreshes address mappings.
- Does not fetch Shopify products.
- Does not create missing Pancake products.
- Does not update Pancake inventory.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- product-sync-orchestrator.service.spec.ts address-sync.service.spec.ts --runInBand
```

Expected: FAIL until mapping-only behavior is explicit.

- [ ] **Step 3: Implement mapping-only behavior**

Add a clearly named internal method such as:

```ts
syncPancakeToSapoPreflightMappings()
```

It may write snapshots and mappings to PostgreSQL, but it must not invoke
Shopify or external write methods.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- product-sync-orchestrator.service.spec.ts address-sync.service.spec.ts --runInBand
```

Expected: PASS.

### Task 6: Verify and deploy without creating orders

**Files:**
- No additional source files required.

- [ ] **Step 1: Run focused Phase 4 tests**

Run:

```powershell
npm test -- env.validation.spec.ts pancake-to-sapo-preflight.service.spec.ts order-webhook-execution.service.spec.ts order-preflight.controller.spec.ts product-sync-orchestrator.service.spec.ts address-sync.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full tests and build**

Run:

```powershell
npm test -- --runInBand
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 3: Rebuild API and worker**

Run:

```powershell
docker compose up -d --build api worker
```

Keep webhook, scheduler, startup sync, and Shopify-related sync disabled.

- [ ] **Step 4: Run approved internal mapping synchronization**

Run only the mapping-only operation. Verify PostgreSQL contains product and
address mappings. Do not create products, inventory changes, customers, or
orders externally.

- [ ] **Step 5: Run read-only preflight**

Call:

```http
GET /orders/preflight/pancake/<approved-order-id>
```

Verify the preview is redacted and all source/location/product/address fields
are valid.

- [ ] **Step 6: Stop before live order creation**

Report the preflight preview and request explicit approval before enabling
webhooks or creating a real Sapo order.
