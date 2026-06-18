# Shopify Hot Inventory Candidates

## Context

The current Sapo to Pancake inventory sync has a hot/backlog candidate model. SKUs with recent Sapo `sourceUpdatedAt` values are processed first and reported as `hotCandidates`; older inventory differences are treated as backlog.

Shopify inventory sync currently runs inside the shared `product-inventory-sync` flow. It updates existing Shopify SKUs and can create missing Shopify products only when explicitly enabled, but it does not prioritize recently updated Sapo SKUs or report hot/backlog counts.

## Goal

Add the same hot-candidate behavior to Shopify inventory updates without changing Pancake behavior.

## Requirements

- Keep Shopify inventory sync inside the existing `product-inventory-sync` job.
- Do not enable missing Shopify product creation by this change. `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false` remains respected.
- Process Shopify update/create candidates in this order:
  1. Hot candidates: Sapo SKU updated within the configured Shopify hot window.
  2. Backlog candidates: older Shopify inventory differences.
- Add a Shopify-specific hot window config:
  - `SYNC_SHOPIFY_INVENTORY_HOT_WINDOW_MINUTES`
  - Default: `30`
- Telegram/log progress for Shopify must include:
  - `hotShopifyCandidates`
  - `backlogShopifyCandidates`
  - existing Shopify candidate/progress fields
- Completion output must also include the Shopify hot/backlog counts.
- Keep SKU blocklist, conflict skip, unchanged-inventory skip, retry/throttle, and max-create-per-run behavior intact.

## Non-Goals

- No Pancake sync behavior changes.
- No new Shopify combo product logic.
- No default enabling of missing Shopify product creation.
- No scheduler cadence changes.

## Testing

Add focused tests in `inventory-sync.service.spec.ts`:

- Hot Shopify candidates are processed before backlog candidates.
- Shopify progress notification includes hot/backlog counts.
- Existing skip behavior still skips unchanged inventory and blocked/conflict SKUs.

