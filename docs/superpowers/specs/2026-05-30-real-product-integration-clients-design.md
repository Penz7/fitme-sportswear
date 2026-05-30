# Real Product Integration Clients Design

## Goal

Implement real product and inventory integration clients for Sapo, Pancake, and Shopify so the existing product inventory sync job can run end-to-end against platform APIs instead of placeholder client methods.

This is the next migration phase after `2026-05-30-product-inventory-sync-design.md`. It keeps the existing sync orchestration, snapshot mapping, SKU matching, conflict handling, and queue/API flow, and replaces client placeholders with real API behavior.

## Scope

In scope:

- Sapo product fetch using the login/session-cookie flow from the Java source.
- Pancake product variation fetch and quantity update.
- Shopify product fetch, location lookup, variant lookup, inventory level update, and variant update when required.
- Config/env validation for the real clients.
- Unit tests with mocked HTTP/fetch responses.

Out of scope:

- Order sync Sapo to Pancake.
- Shopify order webhook to Sapo and fulfillment back to Shopify.
- Pancake webhook processors.
- Telegram/Gemini/address normalization.
- Scheduled jobs.
- Real external API tests using production credentials.
- Auto-create product behavior.

## Architecture

Use the existing platform modules and extend their clients while keeping the product sync services stable:

- `SapoSessionService` owns Sapo login, cookie storage, session refresh, and retry-on-401 behavior.
- `SapoClient` uses `SapoSessionService` to fetch products from Sapo with pagination.
- `PancakeClient` owns Pancake API key query handling, product variation fetch, and quantity update.
- `ShopifyClient` owns Shopify Admin REST API calls, Link-header pagination, variant lookup, location lookup, and inventory update.

The existing contracts remain the boundary consumed by `ProductSnapshotService`:

- `SapoProductResponse[]`
- `PancakeProductResponse[]`
- `ShopifyProductResponse[]`

The current `ProductSnapshotService`, mappers, matching, conflict rules, `InventorySyncService`, `ProductSyncOrchestratorService`, queue, and `/sync/products` endpoints should not need broad redesign.

Use built-in `fetch` in Node instead of adding an HTTP dependency. Keep request helpers small and local to each client unless duplication becomes substantial.

## Configuration

### Sapo

Required for real Sapo product sync:

- `SAPO_BASE_URL`, for example `https://fitme-sportswear.mysapogo.com`
- `SAPO_ACCOUNT_BASE_URL`, default `https://accounts.sapo.vn`
- `SAPO_PHONE_NUMBER`
- `SAPO_PASSWORD`
- `SAPO_CLIENT_ID`
- `SAPO_SHOP_DOMAIN`

Sapo product sync follows the Java source and uses session cookies, not bearer tokens. `SAPO_ACCESS_TOKEN` should no longer be required for this product sync path.

### Pancake

Required:

- `PANCAKE_BASE_URL`, for example `https://pos.pages.fm/api/v1`
- `PANCAKE_API_KEY`
- `PANCAKE_SHOP_ID`

### Shopify

Required:

- `SHOPIFY_BASE_URL` or a full Shopify Admin REST base URL
- `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_API_VERSION`, default `2024-04`

Optional:

- `SHOPIFY_LOCATION_ID`; if missing, fetch locations and cache the first location ID.

`SHOPIFY_WEBHOOK_SECRET` remains required only for webhook work, not product sync, unless current project validation still requires it for other modules.

## Sapo API Design

### Session login

`SapoSessionService` performs the Java login flow:

1. `POST {SAPO_ACCOUNT_BASE_URL}/login`
   - `Content-Type: application/x-www-form-urlencoded`
   - form fields:
     - `phoneNumber`
     - `password`
     - `clientId`
     - `countryCode=84`
     - `isFixedDomain=false`
     - `Product=pos`
     - `suffix-domain=mysapogo.com`
2. `GET {SAPO_ACCOUNT_BASE_URL}/oauth/authorize?...`
   - `Referer: {SAPO_BASE_URL}/`
   - includes `client_id`, `redirect_uri`, `state`, `scope=profile`, `response_type=code`
3. `GET {SAPO_BASE_URL}/admin/authorization/login?returnUrl=/admin`
   - `Referer: {SAPO_BASE_URL}/`

The service stores cookies from `Set-Cookie` headers in memory and provides a cookie header to Sapo requests.

### Product fetch

`SapoClient.fetchProducts()` fetches pages from:

`GET {SAPO_BASE_URL}/admin/products/search.json?page={page}&limit={limit}`

Behavior:

- Ensure a session before the first request.
- Use a sensible page limit, for example `50` or `100`.
- Continue until metadata indicates all products are fetched, or until a page returns no products.
- On `401`, refresh session and retry the request up to 3 attempts.
- Return flattened `products[]` as `SapoProductResponse[]`.

## Pancake API Design

### Product variation fetch

`PancakeClient.fetchProducts()` fetches pages from:

`GET {PANCAKE_BASE_URL}/shops/{PANCAKE_SHOP_ID}/products/variations?page_size={pageSize}&page_number={pageNumber}&api_key={PANCAKE_API_KEY}`

Behavior:

- Include `search` only when explicitly needed; product sync fetch-all does not require it.
- Continue until `pageNumber >= totalPages` or returned data is empty.
- Return flattened `data[]` as `PancakeProductResponse[]`.

### Quantity update

`PancakeClient.updateInventory(input)` calls:

`POST {PANCAKE_BASE_URL}/shops/{PANCAKE_SHOP_ID}/variations/{variantId}/update_quantity?api_key={PANCAKE_API_KEY}`

Payload:

```json
{
  "variations_warehouses": [
    {
      "warehouse_id": "...",
      "remain_quantity": 10
    }
  ]
}
```

Only sync mappings that already passed the existing conflict checks. The earlier phase marks Pancake multi-warehouse products as conflict, so this method should only receive zero-or-one warehouse cases.

## Shopify API Design

### Product fetch

`ShopifyClient.fetchProducts()` calls:

`GET {SHOPIFY_BASE_URL}/products.json?limit=250&fields=id,title,vendor,product_type,status,images,variants`

Behavior:

- Send `X-Shopify-Access-Token`.
- Follow `Link` response header with `rel="next"` and `page_info` until no next link remains.
- Return flattened `products[]` as `ShopifyProductResponse[]`.

### Location fallback

If `SHOPIFY_LOCATION_ID` is configured, use it.

Otherwise call:

`GET {SHOPIFY_BASE_URL}/locations.json`

Cache the first location ID in memory for subsequent inventory updates.

### Inventory update

`ShopifyClient.updateInventoryAndPrice(input)`:

1. Fetch variant:
   - `GET {SHOPIFY_BASE_URL}/variants/{variantId}.json`
2. If `inventory_management !== "shopify"`, update the variant while preserving existing values and applying the new available quantity/price only when necessary.
3. Set inventory level:
   - `POST {SHOPIFY_BASE_URL}/inventory_levels/set.json`
   - payload:
     ```json
     {
       "inventory_item_id": "...",
       "location_id": "...",
       "available": 10
     }
     ```

The Java source keeps price unchanged for matched Shopify products. In this NestJS phase, `InventorySyncService` passes `retailPrice`; the client should either update price only if explicitly required by the existing sync decision or preserve price to match the Java behavior. The default should be to update inventory and preserve existing Shopify price unless the sync design later explicitly enables price sync.

## Error Handling

- Client placeholder methods must not silently return `[]` or no-op in production code.
- If credentials/config are missing, throw a clear configuration error during the client operation.
- Sapo request `401` triggers session refresh and retry.
- Platform snapshot fetch failure throws and causes `ProductSyncOrchestratorService` to mark the `SyncRun` as `failed`.
- Per-SKU Pancake/Shopify update failures remain handled by `InventorySyncService` and are recorded in `SyncRun.metadata.errors`.
- Do not add real external retries beyond the Sapo session retry unless tests show they are needed.

## Testing

Use mocked `fetch` or small injectable request helpers. Do not call real external APIs in automated tests.

Tests should cover:

### Sapo

- `SapoSessionService` builds the login form and stores cookies.
- Sapo `401` refreshes session and retries.
- Login failure throws a clear error.
- `SapoClient.fetchProducts()` follows pagination and returns flattened products.

### Pancake

- `PancakeClient.fetchProducts()` appends `api_key`, `page_size`, and `page_number`.
- Pagination stops at `totalPages`.
- `PancakeClient.updateInventory()` sends `variations_warehouses` payload with `warehouse_id` and `remain_quantity`.

### Shopify

- `ShopifyClient.fetchProducts()` sends token header and follows `Link rel="next"` pagination.
- Location fallback fetches and caches first location.
- `updateInventoryAndPrice()` gets variant, uses `inventory_item_id`, and sends the inventory level set payload.
- Variant update path for `inventory_management !== "shopify"` preserves existing fields.

### Existing sync integration

- Existing product sync tests continue passing.
- Add at most lightweight tests confirming `ProductSnapshotService` uses the real client contract shape; do not duplicate mapper tests.

## Acceptance Criteria

- `POST /sync/products` no longer succeeds with empty placeholder clients when real API config is present.
- Sapo/Pancake/Shopify clients fetch product snapshots using real API behavior from the Java source.
- Pancake inventory update and Shopify inventory update build the expected payloads.
- Existing product sync conflict safeguards remain intact.
- `npm test -- --runInBand` passes.
- `npm run build` passes.
- `npm run lint` may still fail only for the known pre-existing ESLint 9 flat config issue, unless that tooling issue is addressed separately.
