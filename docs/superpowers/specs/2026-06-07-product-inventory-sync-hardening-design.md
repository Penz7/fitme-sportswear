# Product Inventory Sync Hardening Design

## Goal

Make Sapo-to-Pancake product and inventory sync safer than the old source by preventing ambiguous SKU updates, creating missing Pancake products idempotently, and alerting operators when manual cleanup is required.

Sapo remains the source of truth. The sync cadence remains controlled by `SYNC_PRODUCT_CRON`, currently every 30 minutes.

## Current Behavior

- Sapo product snapshots use `variant.sku`.
- Sapo `available` is calculated as the sum of `inventories.available` across all Sapo warehouses.
- Sapo `remain` is calculated as the sum of `inventories.onHand` across all Sapo warehouses.
- Pancake snapshots use `displayId` as SKU.
- Pancake `available` is calculated from `remainQuantity`.
- Pancake `remain` is calculated from `actualRemainQuantity`.
- Inventory update to Pancake sends `remain_quantity = Sapo available`.
- Missing Pancake product creation is enabled by `SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=true`.

## Proposed Behavior

### SKU Normalization

Introduce a single normalized SKU rule for matching:

- Trim leading and trailing whitespace.
- Collapse internal whitespace around SKU text.
- Compare case-insensitively.
- Preserve the original SKU value when writing platform records.

This prevents accidental mismatch caused by minor SKU formatting differences while keeping the visible SKU unchanged.

### Conflict Blocking

The sync must not update or create Pancake products when a SKU is ambiguous.

Block the SKU when any of these cases are found:

- One normalized SKU maps to multiple Sapo product variants.
- One normalized SKU maps to multiple Pancake variations.
- Existing product mapping points to a different platform product or variant than the latest snapshot.

Blocked SKUs are skipped for inventory update and product creation. Other SKUs in the same sync run continue normally.

### Conflict Records

Persist conflict records with enough information for manual cleanup:

- normalized SKU
- original Sapo/Pancake SKU values involved
- conflict type: `duplicate_sapo_sku`, `duplicate_pancake_sku`, or `ambiguous_mapping`
- involved product IDs and variant IDs
- first seen timestamp
- last seen timestamp
- resolved timestamp, when no longer present
- last notification timestamp

The sync should upsert conflict records instead of creating duplicates on every run.

### Telegram Alerts

Send Telegram alerts only for important conflict events:

- Send when a new unresolved conflict appears.
- Do not send the same unresolved conflict repeatedly every sync run.
- Send an optional resolved message only if the existing Telegram notifier pattern already supports this cleanly.

Alert content:

- SKU
- conflict type
- affected platform
- number of Sapo variants and Pancake variants
- action taken: skipped inventory sync for this SKU

Example:

```text
[Fitme Sync] SKU conflict detected

SKU: ABC123
Issue: duplicate_pancake_sku
Sapo variants: 1
Pancake variants: 3

Action: skipped inventory update for this SKU.
Please resolve duplicate mapping manually.
```

### Idempotent Missing Product Creation

Before creating a missing Pancake product from Sapo:

- Re-check current database snapshots for the normalized SKU.
- Re-check existing mappings.
- If a Pancake variant now exists, update mapping instead of creating.
- If the SKU is conflict-blocked, skip creation.

After a successful create:

- Save Pancake product ID, variant ID, and warehouse ID.
- Save or update the product mapping.
- Then update Pancake `remain_quantity` from Sapo `available`.

### Inventory Source Rules

Keep Sapo as the inventory source:

- Sapo `available` across all 3 warehouses updates Pancake `remain_quantity`.
- Sapo `onHand` across all 3 warehouses remains stored for audit/comparison.
- Keep `SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false` so order webhooks do not directly mutate Pancake inventory.

## Error Handling

- A conflict on one SKU must not fail the whole sync run.
- Telegram failure must not fail the product sync run.
- API update/create errors continue to be collected in the sync result errors list.
- Conflict records should be available even if Telegram is unavailable.

## Testing

Add focused tests for:

- SKU normalization.
- Duplicate Sapo SKU detection.
- Duplicate Pancake SKU detection.
- Ambiguous mapping detection.
- Conflict-blocked SKU skipped from inventory update.
- New conflict sends Telegram once.
- Existing unresolved conflict does not spam Telegram.
- Missing Pancake product create remains idempotent.

## Out Of Scope

- Changing the sync interval.
- Updating Pancake `actualRemainQuantity` unless the current Pancake API contract clearly supports it.
- Re-enabling Shopify product sync.
- Auto-resolving duplicate platform products.
