# Order Inventory Impact Rules Design

## Goal

Cover the legacy order-status business rules that decide whether an order event affects sellable quantity, physical inventory, both, or neither.

## Scope

This phase adds a pure rules service for Sapo and Pancake order statuses. It does not directly mutate stock. Existing product inventory sync remains the stock writer; order/webhook flows can use the rules service for metadata, audit, and later inventory event idempotency.

## Rules

Sapo:
- `draft`, `finalized` without shipment, and `packed`/`unshipped` affect sellable quantity only.
- `shipped` and `completed` affect physical inventory only.
- `cancelled` affects both physical inventory and sellable quantity.
- Unknown states affect neither.

Pancake:
- `NEW`, `WAITING_FOR_STOCK`, `ORDERED`, `WAITING_FOR_PRINT`, `PRINTED`, `CONFIRMED`, and `PACKING` affect sellable quantity only.
- `WAITING_FOR_SHIPPING`, `SHIPPED`, `RECEIVED`, `MONEY_COLLECTED`, `RETURNING`, and `PARTIALLY_RETURNED` affect physical inventory only.
- `RETURNED`, `CANCEL_ORDER`, and `DELETE_ORDER` affect both physical inventory and sellable quantity.
- Unknown codes affect neither.

## Architecture

Create `OrderInventoryImpactService` in `src/modules/orders/`. The service exposes `resolveSapoImpact(order)` and `resolvePancakeImpact(statusCode)` and returns a small object with `quantityEffect`, booleans for `affectsAvailable` and `affectsOnHand`, and a stable `reason`.

`OrderWebhookProcessingService` will depend on this service and use `resolvePancakeImpact()` instead of directly calling the mapper function. This keeps webhook planning focused on actions while the status-impact rules remain separately testable.

## Testing

Unit tests must cover all statuses listed in `docs/business-flow/sapo-pancake-shopify-flow-mapping.md`, including unknown states. Existing webhook processing tests must continue passing after integration.
