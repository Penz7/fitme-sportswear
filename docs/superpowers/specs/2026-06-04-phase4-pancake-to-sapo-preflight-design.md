# Phase 4 Pancake-to-Sapo Preflight Design

## Goal

Make the Pancake-to-Sapo order creation path safe for Phase 4 by ensuring every
field has a verified source and by rejecting incomplete orders before any Sapo
write request is made.

Phase 4 covers only:

`Pancake order -> backend preflight -> Sapo order`

Sapo-to-Pancake order creation and Shopify are out of scope.

## Safety Boundary

- Webhook ingestion, Pancake webhook processing, schedulers, and startup sync
  remain disabled by default.
- Mapping synchronization and preflight may write only to the backend database.
- Preflight must never create or update customers, orders, payments,
  fulfillments, inventory, or other external records.
- Creating a real Sapo order requires a separate explicit approval after the
  redacted preflight preview is reviewed.

## Verified Configuration

The backend must read and validate these values without runtime fallbacks:

- `SAPO_PANCAKE_SOURCE_ID=5632931`
- `SAPO_LOCATION_ID`
- `PANCAKE_DEFAULT_WAREHOUSE_ID`
- `SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID`
- `SAPO_PREPAYMENT_METHOD_ID`
- `SAPO_PREPAYMENT_METHOD_NAME`

`SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID` is a JSON object whose keys are
Pancake warehouse IDs and whose values are Sapo location IDs. The configured
default Pancake warehouse must exist in this mapping.

## Mapping Synchronization

Before an order can pass preflight, the backend database must contain:

- Sapo product snapshots.
- Pancake product snapshots.
- Product mappings with Sapo product ID, Sapo variant ID, Pancake product ID,
  Pancake variant ID, and Pancake warehouse ID.
- Province, district, and ward mappings needed by the test order.

Mapping synchronization must not create products, update inventory, create
orders, or call Shopify.

## Pancake Order Validation

Preflight rejects an order unless all required data is present and valid:

- Pancake order ID.
- Warehouse ID that maps to a Sapo location ID.
- Customer full name.
- Customer phone number.
- Total price greater than or equal to zero.
- Shipping full address.
- Shipping province ID and name.
- Shipping district ID and name.
- Shipping commune ID and name.
- At least one line item.

Every line item requires:

- Non-empty SKU sourced from the Pancake variation barcode/display ID.
- Quantity greater than zero.
- Price greater than or equal to zero.
- Existing product mapping with non-empty Sapo product and variant IDs.

Missing numeric values must remain missing and cause validation failure. They
must not be converted to zero automatically.

## Sapo Order Payload

The validated Sapo payload contains:

- Code: `AUTO_PANCAKE_<pancake-order-id>`.
- Source ID from `SAPO_PANCAKE_SOURCE_ID`.
- Location ID resolved from the Pancake warehouse mapping.
- Status `placed`.
- Verified total, note, tags, email, and phone.
- Customer data and shipping address, including ward.
- Line items with SKU, quantity, price, discount, Sapo product ID, and Sapo
  variant ID.

Prepayment is included only when Pancake provides a positive prepaid amount and
both configured Sapo payment method fields are valid.

## Preflight Preview

The backend exposes a preflight operation that:

1. Reads a Pancake order by ID.
2. Builds and validates the Sapo order payload.
3. Returns a redacted preview and validation result.
4. Makes no external write requests.

The preview redacts customer name, phone number, email, and street address. It
shows IDs, field presence, item SKUs, quantities, prices, totals, source ID,
warehouse ID, and resolved Sapo location ID.

## Error Handling

- Validation errors identify every missing or invalid field in one response.
- Missing mappings identify the affected SKU or address level.
- No Sapo write method may be called when preflight fails.
- Duplicate Pancake order IDs already present in order mappings are rejected
  before creation.
- External read failures are returned as preflight failures without attempting
  writes.

## Testing

Automated tests must prove:

- Missing required customer, address, warehouse, total, or item data fails.
- Missing product/address mappings fail.
- `null` numeric fields do not become zero.
- Source, location, and payment method values come from configuration.
- A valid Pancake order produces the expected Sapo payload.
- Preview redacts sensitive fields.
- Failed and successful preflight calls never invoke Sapo write methods.
- Existing webhook/order execution behavior remains covered.

## Phase 4 Completion Criteria

Phase 4 is ready for a live-order approval only when:

- Focused and full backend tests pass.
- Backend builds and starts successfully.
- Product and required address mappings exist.
- A selected real Pancake order or controlled test payload passes preflight.
- The user reviews the redacted preview and explicitly approves creating the
  real Sapo order.
