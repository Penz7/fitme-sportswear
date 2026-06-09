# Combo SKU Auto-Create Guard Design

## Context

The Sapo-to-Pancake inventory reconciliation currently supports creating a
recent Sapo SKU when that SKU is missing from Pancake. During the June 9,
2026 reconciliation run, this behavior created 20 combo SKUs on Pancake.

Example:

`FM-ATSO01-DO-L-FM-VSFM01-TR-L`

Live Pancake API inspection confirmed these records were created as ordinary
products:

- `is_composite=false`
- `composite_products=[]`
- inventory was assigned directly to the combo SKU

This is unsafe because a combo SKU may represent multiple component SKUs and
may require separate composite-product behavior. The inventory sync service
must not infer or construct that behavior.

## Goal

Prevent the Sapo-to-Pancake inventory sync from automatically creating a
missing Pancake product when the Sapo SKU is a combo SKU, while preserving all
existing inventory synchronization behavior for ordinary SKUs and combo SKUs
that already exist on Pancake.

## Combo Detection

A SKU is treated as a combo SKU when its normalized value contains a second
Fitme SKU marker after the first component:

`-FM-`

Examples detected as combo SKUs:

- `FM-ATSO01-DO-L-FM-VSFM01-TR-L`
- `FM-ATSO01-HP-L-FM-QDZT01-DE-XL`

Examples not detected as combo SKUs:

- `FM-ATSO01-DO-L`
- `FM-ATTL01-HP-XL`
- `VV-DXSP01-TR-M`

Detection must operate on the normalized SKU and must be encapsulated in a
small, independently tested helper.

## Required Behavior

### Missing Combo SKU On Pancake

When a Sapo combo SKU is missing from Pancake:

- Do not call Pancake product creation APIs.
- Do not create a Pancake product cache record or matched product mapping.
- Record the SKU as skipped because it is a combo SKU.
- Continue processing all other SKUs in the same job.

### Existing Combo SKU On Pancake

When a combo SKU already exists on Pancake:

- Continue normal Sapo-to-Pancake inventory comparison.
- Skip when inventory is equal.
- Update Pancake inventory when inventory differs.
- Continue respecting blocklist, duplicate/conflict, warehouse, retry, and
  circuit-breaker rules.

### Ordinary SKU

Ordinary SKU behavior remains unchanged:

- Existing ordinary SKUs continue inventory reconciliation.
- Recent ordinary SKUs missing from Pancake may still be automatically created
  when the existing recent-missing-product configuration permits it.

## Reporting

Extend the inventory sync result metadata with:

- `skippedComboCreate`: total missing combo SKUs that were not created.
- `skippedComboCreateSkus`: up to 20 representative skipped combo SKUs.

The Telegram completion summary must include both fields. Combo skips are
operational information, not job failures, and must not trigger the
`completed with errors` notification.

## Processing Order

For each mapping, the service evaluates rules in this order:

1. Blocklist.
2. Conflict or missing Sapo source.
3. Existing Pancake variant with missing warehouse handling.
4. Missing Pancake variant:
   - Skip and report if the SKU is a combo SKU.
   - Otherwise apply the existing recent-missing-product creation rules.
5. Equal inventory skip.
6. Inventory update candidate.

This order preserves the current safety controls and ensures a blocklisted or
conflicting combo SKU is reported under the more important existing reason.

## Configuration

Combo auto-create protection is always enabled. It is a safety invariant and
does not require a new environment variable.

The existing settings remain unchanged:

- `SYNC_SAPO_TO_PANCAKE_INVENTORY_CREATE_RECENT_MISSING_PANCAKE_PRODUCTS`
- `SYNC_SAPO_TO_PANCAKE_INVENTORY_CREATE_RECENT_MISSING_PANCAKE_WINDOW_MINUTES`
- `SYNC_SAPO_TO_PANCAKE_INVENTORY_CREATE_RECENT_MISSING_PANCAKE_MAX_PER_RUN`
- Product sync blocklist settings

## Data And Cleanup

This change does not automatically delete the 20 combo products already
created on Pancake or their local mappings. Cleanup is a separate explicit
operation because deletion affects external platform data.

After the guard is deployed:

- Existing combo products remain eligible for inventory sync.
- Future missing combo products are not automatically created.

## Testing

Add focused tests covering:

1. A recent missing combo SKU is skipped and product creation is not called.
2. A skipped combo SKU increments and records combo skip metadata.
3. An existing combo SKU with mismatched inventory is updated normally.
4. An ordinary recent missing SKU is still created normally.
5. Telegram completion summary includes combo skip information.

Run the existing inventory sync and Pancake client test suites, then build the
backend.

## Rollout And Verification

1. Keep the backend stopped during implementation and verification.
2. Run focused tests and build.
3. Start API and worker only after verification passes.
4. Run a dry-run or targeted sync containing:
   - one missing combo SKU,
   - one existing combo SKU,
   - one ordinary missing SKU.
5. Confirm the missing combo SKU is reported but not created on Pancake.
6. Confirm ordinary and existing SKU behavior remains unchanged.

