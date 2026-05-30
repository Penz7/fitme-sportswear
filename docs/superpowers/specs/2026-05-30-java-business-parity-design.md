# Java Business Parity Design

## Goal

Bring the remaining business behavior from `sportswear-main` into `fitme-sportswear-backend` with parity to the Java source before adding broader hardening. The migration keeps Sapo as the source of truth for product inventory and uses Pancake/Shopify as sales channels.

## Source Behavior

The Java source has four important business loops:

1. `BusinessProductService.syncProducts()` fetches Sapo products, stores snapshots, then updates matched Pancake and Shopify inventory from Sapo `available`.
2. `BusinessOrderService.processTopOrders(type, prefix)` fetches top Sapo orders by business type, compares them with `sapo_orders_tracking`, and only processes newly seen order IDs.
3. `BusinessOrderService.createOrUpdateOrder()` creates or updates Pancake orders from Sapo orders for the `AUTO_PANCAKE` prefix. For `AUTO_SHOPIFY`, it only cancels Shopify orders when Sapo order type is `CANCELED`.
4. `BusinessLogService.handleBySapoLogs()` polls Sapo logs, extracts changed order IDs from log URIs, fetches those orders, and reuses the normal order sync path.

Pancake webhooks also drive Sapo:

- `order_created` creates a Sapo customer if missing, creates the Sapo order, finalizes it, creates a prepayment when prepaid amount exists, and stores `OrderMapping`.
- `order_updated` maps Pancake status to Sapo actions:
  - `CONFIRMED`: update Sapo order.
  - `PACKING`: create Sapo fulfillment.
  - `SHIPPED`: ensure fulfillment, then ship it.
  - `CANCEL_ORDER`: cancel fulfillment if present, receive after cancellation, then cancel the Sapo order.
  - Passive statuses are recorded but do not mutate Sapo.

## Design

### Order Type Tracking

Add a Prisma model equivalent to Java `SapoOrderTracking`:

- `type`: stable key such as `PACKED_AUTO_PANCAKE`.
- `orderIds`: JSON array of the last fetched Sapo order IDs.
- `lastUpdate`: timestamp.

`SapoTopOrderSyncService` will fetch orders for a specific business type and prefix, compare current IDs with tracked IDs, sync only new IDs, then replace the tracked ID list. This matches Java's behavior and avoids processing the same top-order list repeatedly.

### Sapo Order Type Filters

Use existing `ORDER_TYPE_MAPPINGS` from `order-status.mapper.ts` as the Java enum equivalent. `SapoTopOrderSyncService` will convert each mapping to Sapo `fetchOrders()` filters. If a type has several Sapo status fields, the first status field/value will be used as the API filter and the returned orders will be checked locally against the complete type predicate.

This keeps API usage compatible with the current client while preserving Java's combined status logic.

### Sapo Logs Polling

Add `SapoLogSyncService`:

- Calls `SapoClient.fetchLogs(page=1, limit=100)`.
- Keeps a persisted idempotency key per Sapo log ID using existing `IdempotencyKey` scope `sapo-log`.
- Extracts order IDs from `uri`:
  - `orders.json` uses `root_id`.
  - `/orders/{id}` extracts the numeric segment.
- Fetches each changed order and sends it through `SapoToPancakeOrderSyncService.syncSapoOrder()`.

This is safer than Java's in-memory one-hour cache because it survives process restarts.

### Scheduler

Extend scheduled sync payloads with:

- `sapo-top-order-sync`
- `sapo-log-sync`

Add env-driven cron settings for Java-equivalent loops. Product sync remains on its existing schedule. Top-order sync can run either as a single scheduled job that processes every Java order type, or as separate jobs per type. The implementation will start with one scheduled job that iterates all Java order types for `AUTO_PANCAKE` and cancels `AUTO_SHOPIFY` orders for type `CANCELED`.

### Inventory Rule

Do not add a separate order-event stock delta writer in this phase. Java's reliable inventory writer is product sync from Sapo `available` to Pancake/Shopify. Existing `OrderInventoryImpactService` remains a rule/audit helper for status classification.

### Error Handling

Each order in a batch is isolated: one failing order records a failed item result but does not stop the whole sync run. The queue processor marks the `SyncRun` failed only when the whole job cannot start or fetch required top-level data.

## Acceptance Criteria

- Prisma has a `sapo_order_tracking` table equivalent.
- Sapo client can fetch logs.
- Backend can run top-order sync across Java order types.
- Backend can run Sapo log sync and process only unseen log IDs.
- Order mappings keep Sapo/Pancake status fields updated after sync.
- Product inventory remains Sapo-source-of-truth and does not introduce duplicate order delta stock writes.
- Unit tests cover tracking, log extraction/idempotency, and scheduler dispatch.
