# Product and Inventory Sync Design

## Goal

Migrate the product and inventory sync behavior from `sportswear-main` into `fitme-sportswear-backend`, while adjusting phase one to use SKU-first matching without automatic product creation.

Sapo is the primary source of truth for product commercial data and inventory. Pancake and Shopify are receiving sales channels that should be synchronized from Sapo when a SKU is already present/mapped.

## Scope

Phase one includes:

- Fetching product snapshots from Sapo, Pancake, and Shopify.
- Persisting platform snapshots locally.
- Matching products by SKU, following the Java source behavior.
- Syncing inventory and price from Sapo to matched Pancake and Shopify records.
- Recording partial mappings and conflicts instead of creating missing products.
- Running the sync through the existing NestJS/BullMQ sync infrastructure.

Phase one does not include:

- Automatically creating Pancake or Shopify products.
- Letting Pancake or Shopify overwrite Sapo.
- Admin UI for resolving conflicts.
- Full order sync, Shopify fulfillment flow, or Pancake webhook processors.

## Architecture

The backend keeps the existing NestJS module structure and adds focused services around product synchronization:

- `SapoClient`, `PancakeClient`, and `ShopifyClient` call each platform API.
- `ProductSnapshotService` fetches and upserts platform product snapshots.
- `ProductMatchingService` matches platform records by SKU and classifies mappings.
- `InventorySyncService` pushes Sapo inventory and price to receiving platforms for valid mappings.
- `SyncService` or a dedicated queue producer starts a `product-inventory-sync` job.
- A BullMQ processor runs the sync and updates `SyncRun` status and metadata.

The canonical hub lives in the NestJS backend. In this phase, the canonical values are derived from Sapo rather than allowing all platforms to contribute equally.

## Database

Extend the Prisma schema with platform snapshot tables based on the Java entities.

### `sapo_products`

Fields:

- `id`
- `sku` unique
- `productId`
- `variantId`
- `name`
- `available`
- `remain`
- `retailPrice`
- `updatedBy`
- `createdAt`
- `updatedAt`

### `pancake_products`

Fields:

- `id`
- `sku` unique
- `productId`
- `variantId`
- `name`
- `available`
- `remain`
- `retailPrice`
- `warehouseId`
- `updatedBy`
- `createdAt`
- `updatedAt`

### `shopify_products`

Fields:

- `id`
- `sku` unique
- `productId`
- `variantId`
- `name`
- `available`
- `remain`
- `retailPrice`
- `updatedBy`
- `createdAt`
- `updatedAt`

### `product_mappings`

Fields:

- `id`
- `sku` unique
- Sapo product and variant identifiers
- Pancake product, variant, and warehouse identifiers
- Shopify product and variant identifiers
- `status`: `matched`, `partial`, or `conflict`
- `conflictReason`
- `createdAt`
- `updatedAt`

Mapping rules:

- SKU is the primary matching key.
- Sapo SKU comes from `SapoProduct.sku`.
- Pancake SKU comes from `ProductData.displayId`, matching the Java source.
- Shopify SKU comes from `variant.sku`.
- A SKU with Sapo plus Pancake and/or Shopify is eligible for sync unless conflicted.
- A SKU missing a receiving platform becomes `partial`.
- Duplicate SKU records within a single platform become `conflict` and are not synced.

## Sync Flow

The `product-inventory-sync` job runs these steps:

1. Create or update a `SyncRun` with `syncType = product-inventory-sync` and `status = running`.
2. Fetch and upsert Sapo product snapshots.
3. Fetch and upsert Pancake product snapshots.
4. Fetch and upsert Shopify product snapshots.
5. Build or update `product_mappings` by SKU.
6. For each non-conflicted mapping with Sapo data:
   - Use Sapo `available` as the inventory source.
   - Use Sapo `retailPrice` as the price source for phase-one price sync.
   - Update Pancake only when `pancakeVariantId` exists.
   - Update Shopify only when `shopifyVariantId` exists.
   - Update local receiving-platform snapshot after each successful API update with `updatedBy = SAPO`.
7. Store counts and per-SKU errors in `SyncRun.metadata`.
8. Mark `SyncRun` as `succeeded` or `failed`.

## Source Java Compatibility

The design intentionally follows the source Java implementation where appropriate:

- Product matching is SKU-based.
- Sapo inventory is derived by summing variant inventory availability.
- Pancake SKU is `displayId`.
- Pancake inventory comes from `variationsWarehouses.remainQuantity`.
- Shopify SKU is `variant.sku`.
- Shopify inventory comes from the variant/inventory quantity fields.
- Platform snapshots are upserted by SKU.

The deliberate difference from the Java source is that phase one disables automatic product creation on Pancake and Shopify. Missing SKUs are recorded as partial mappings instead.

## Error Handling

Per-SKU update failures do not stop the whole job. They are recorded in `SyncRun.metadata.errors` with:

- `sku`
- `platform`
- `operation`
- `message`

A full snapshot fetch failure for Sapo, Pancake, or Shopify fails the job because the input dataset is incomplete.

The sync skips a platform update when required identifiers are missing, such as a Pancake variant ID or Shopify variant ID.

## Conflict Handling

Sapo is the primary source. Pancake and Shopify should not overwrite Sapo in phase one.

Conflict rules:

- Duplicate SKU in one platform is a conflict.
- Missing required identifiers can become partial or conflict depending on whether another receiving platform is still usable.
- Pancake or Shopify values that differ from Sapo are overwritten from Sapo for matched records.
- Ambiguous cases are recorded as `conflict` and skipped.

Future phases can add change-event tracking and manual conflict resolution if true multi-writer synchronization is required.

## Testing

Unit tests should cover:

- Sapo snapshot mapping and inventory summing.
- Pancake `displayId` to SKU mapping and warehouse quantity summing.
- Shopify variant SKU mapping.
- SKU matching into matched, partial, and conflict states.
- Duplicate SKU conflict handling.
- Sync decisions that prevent auto-create.
- Pancake inventory update payload construction.
- Shopify inventory update conditions.
- Per-SKU API failures being recorded without stopping the whole job.

Service-level tests should mock the three platform clients and verify that only matched records produce update calls.
