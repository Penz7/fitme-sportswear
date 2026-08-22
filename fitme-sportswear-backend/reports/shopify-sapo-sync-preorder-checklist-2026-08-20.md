# Shopify - Sapo Sync Checklist and PreOrder Plan

Date: 2026-08-20
Last updated: 2026-08-22

Scope: planning/checklist only. No production code changes are included in this document.

## 1. Shopify - Sapo Order Sync Checklist

### 1.1 Sync Viettel Post tracking code in all valid cases

Goal:

- When Sapo has a real Viettel Post tracking code, Shopify should be fulfilled with that tracking code as soon as possible.
- This should work even when the Sapo order has not moved to completed yet.
- The system must not use Sapo packing codes such as `FUN...` as Shopify tracking numbers.

Current behavior observed:

- Shopify order webhook creates/finalizes/updates Sapo order and creates Sapo fulfillment.
- The system waits for Sapo shipment tracking for a short period.
- Shopify fulfillment is created only when Sapo shipment has `pushing_status = completed` and a tracking code.
- Existing background Sapo top-order sync creates Shopify fulfillment only for Sapo order groups `SHIPPED`, `RECEIVED`, or `COMPLETED`.
- Therefore, if Sapo gets a VTP code while the order is still `packed/unshipped`, Shopify may not be fulfilled immediately.

Recommended direction:

- Add a reconciliation flow for `AUTO_SHOPIFY` orders where Shopify is not fulfilled yet.
- Scan recent mapped Sapo orders in states such as `packed/unshipped`, `shipped`, `received`, and `completed`.
- If Sapo fulfillment shipment has `pushing_status = completed` and a real VTP tracking code, create Shopify fulfillment.
- Keep idempotency checks to avoid duplicate Shopify fulfillment.
- Keep the rule: no fallback to uncompleted `tracking_code`.

Testing required:

- Sapo packed/unshipped order with completed VTP tracking should fulfill Shopify.
- Sapo packed/unshipped order with `FUN...` or uncompleted tracking should not fulfill Shopify.
- Already fulfilled Shopify order should not be fulfilled again.
- Cancelled Shopify/Sapo orders should not be fulfilled.

Risk level: medium-high because duplicate fulfillment or wrong tracking would directly affect customers.

### 1.2 Send shipping email to customer

Goal:

- Customer receives shipping/tracking email when Shopify fulfillment is created.

Current mechanism:

- The backend creates Shopify fulfillment with `notify_customer = true`.
- Shopify handles the actual email notification.
- The backend does not send a separate custom email.

Recommended direction:

- Continue using Shopify fulfillment notification with `notify_customer = true`.
- Include tracking company and tracking number.
- Consider adding tracking URL if Viettel Post tracking URL format is stable and Shopify does not auto-detect Viettel Post well.
- If custom wording is needed, update Shopify notification templates in Shopify Admin.
- If per-order custom email content is required, build a separate email sender later.

Testing required:

- Create fulfillment on a test Shopify order with `notify_customer = true`.
- Confirm customer receives email.
- Confirm tracking number and carrier display correctly.
- Confirm whether Shopify generates a usable tracking link for Viettel Post.

Risk level: medium. Shopify email depends on Shopify notification settings and customer email availability.

### 1.3 Sync voucher, discount, and shipping fee from Shopify to Sapo

Goal:

- Shopify voucher/discount and shipping fee are reflected correctly on Sapo orders.

Items to map:

- Shopify `discount_codes`
- Shopify `discount_applications`
- Shopify line-level discounts
- Shopify order-level discount
- Shopify `shipping_lines`
- Shopify total shipping fee
- Shopify total discount
- COD / payment amount if applicable

Recommended direction:

- Review existing Shopify-to-Sapo order mapper.
- Define a single money mapping rule:
  - product subtotal
  - discount amount
  - shipping fee
  - total paid / total collect
- Add tests using real Shopify payload examples:
  - no discount, paid shipping
  - voucher discount, paid shipping
  - free shipping voucher
  - line item discount
  - multiple discount applications

Risk level: high. This affects order totals, accounting, COD, and customer payment expectations.

### 1.4 Sync order notes

Goal:

- Important Shopify order notes are visible on Sapo.

Possible fields:

- Shopify `note`
- Shopify `note_attributes`
- Shopify tags
- shipping note
- payment note
- generated integration note such as `AUTO_SHOPIFY`, tracking status, or preorder status

Recommended direction:

- Define which Shopify fields should be copied to Sapo notes.
- Preserve existing operational note used by the warehouse.
- Avoid overwriting manual warehouse notes after order creation.

Testing required:

- Shopify order with note.
- Shopify order with note attributes.
- Shopify order update where Sapo already has manual note.

Risk level: low-medium.

## 2. PreOrder Plan

### 2.1 Requirement

Allow PreOrder only for selected products/SKUs, not the whole shop.

Basic rule:

- If Sapo stock is greater than 0: product sells normally on Shopify.
- If Sapo stock is 0 and SKU is allowed for PreOrder: Shopify should allow selling and storefront should show PreOrder.
- If Sapo stock is 0 and SKU is not allowed for PreOrder: product remains out of stock.

### 2.2 Simple PreOrder implementation direction

Backend side:

- Store a per-SKU or per-product setting such as `allow_preorder = true`.
- During Sapo-to-Shopify inventory sync:
  - If stock > 0:
    - set normal inventory behavior
    - remove/disable preorder marker
  - If stock = 0 and `allow_preorder = true`:
    - set Shopify variant to continue selling when out of stock
    - add tag/metafield such as `preorder = true`
  - If stock = 0 and `allow_preorder = false`:
    - do not allow selling out of stock
    - remove/disable preorder marker

Shopify storefront side:

- Theme or app reads product/variant tag/metafield.
- If `preorder = true` and stock <= 0, show button text like `PreOrder`.
- If stock > 0, show normal button text like `Mua ngay`.

### 2.3 Shopify app option

Shopify App Store has apps that support PreOrder features.

App-based direction:

- App handles storefront UI, preorder labels, expected delivery date, rules, and customer messaging.
- Backend continues to sync Sapo stock.
- Backend can update Shopify tags/metafields so the app knows which products should be preorder-enabled.

Pros:

- Faster UI setup.
- More complete preorder features.
- Less custom Shopify theme logic.

Cons:

- Monthly app cost.
- Dependency on app behavior and API.
- Need to verify the app can be automated by SKU/metafield/tag.

### 2.4 PreOrder payment requirement and Shopify plan limits

Requirement:

- Normal products should allow the normal payment options, such as COD and bank transfer/online payment.
- PreOrder products should require prepaid payment.
- If the cart contains any PreOrder item, COD should be hidden or blocked.
- If the cart contains only normal products, COD should remain available.

Important distinction:

- The backend can detect PreOrder after the Shopify order is created.
- The backend can tag/note the order, sync it to Sapo, and manage allocation.
- The backend cannot reliably hide COD during Shopify checkout after the customer has already reached payment selection.
- Checkout payment control must happen inside Shopify checkout/payment customization, a Shopify app, or a Shopify Function.

Observed store context:

- Fitme Shopify store is on plan `basic`.
- Current backend Shopify app is not a Shopify Function extension.
- Current backend source has no `paymentMethodHide` logic and no `shopify.extension.toml`.
- Therefore, the current backend does not currently enforce "PreOrder must prepay, normal products may use COD" at checkout.

Best technical behavior:

```text
if cart contains PREORDER product/variant:
  hide COD
  keep prepaid methods, such as bank transfer/online payment
else:
  keep COD and prepaid methods
```

Best implementation direction:

- Mark selected PreOrder products/variants by tag or metafield, for example `PREORDER` or `custom.preorder_enabled = true`.
- Use Shopify Payment Customization / Shopify Functions or an app that supports payment method hiding.
- The payment customization checks cart lines.
- If any line is PreOrder, it hides COD.
- If no line is PreOrder, it does not hide COD.

Non-Plus / Basic limitation:

- On Shopify Basic/non-Plus, this should not be assumed to be fully self-codeable from the current NestJS backend.
- Shopify Payment Customization is the right Shopify-level mechanism, but custom checkout/payment behavior can be restricted by plan and app type.
- Public apps from Shopify App Store may support this for non-Plus shops.
- A custom app/function built specifically for this store may require Shopify Plus for some checkout/payment customization use cases.
- This needs validation in Shopify Admin/app installation before committing to a custom-code-only approach.

Practical recommended path for Fitme:

1. Backend owns the PreOrder source of truth:
   - selected SKU/product allowlist
   - preorder limit
   - pending preorder quantity
   - Shopify tag/metafield update
   - Sapo/Shopify order notes and tags
2. Shopify app/function owns checkout payment visibility:
   - hide COD when cart has PreOrder
   - keep COD for normal products
3. Theme/app owns storefront display:
   - show `PreOrder`
   - show expected restock/shipping wording
4. Backend owns fulfillment/tracking:
   - do not ship before stock allocation
   - sync VTP tracking when Sapo has valid completed tracking
   - let Shopify send tracking email via fulfillment notification

Risks and constraints:

- If no payment customization app/function is available for Basic, the backend can only mark orders after creation, not prevent COD at checkout.
- If COD is not hidden, customers may place PreOrder orders as COD, which violates the prepaid requirement.
- Shopify accelerated checkout methods may have behavior that differs from normal checkout; this must be tested.
- Shopify POS/payment flows are outside this scope.
- Mixed cart behavior must be defined:
  - recommended rule: any PreOrder item in cart means COD is hidden for the whole cart.
  - alternative rule: block mixed cart if business wants stricter control.

Test cases:

- Cart has only normal products: COD is visible.
- Cart has one PreOrder product: COD is hidden.
- Cart has normal + PreOrder products: COD is hidden.
- PreOrder product is no longer preorder after stock allocation: COD becomes visible again for that product when it sells normally.
- Order created with prepaid method: Shopify financial status should show paid/authorized/pending according to the selected payment method.
- Manual bank transfer order should not be treated as fully paid until Shopify/Sapo/payment operation confirms payment.

### 2.5 Main PreOrder risks

#### Overselling

If Shopify continues selling when stock is 0, customers can keep placing orders. Without a limit, preorder quantity can become too high.

Mitigation:

- Add preorder limit per SKU.
- Track pending preorder quantity.
- Stop preorder when pending preorder quantity reaches the limit.

#### Negative Shopify inventory

PreOrder orders can make Shopify inventory negative.

Mitigation:

- Treat negative Shopify stock as expected for preorder-enabled SKUs.
- Use Sapo stock as source of truth.
- Report pending preorder quantity separately.

#### PreOrder orders do not automatically become normal orders

A Shopify order placed during preorder is still a normal Shopify order technically. The system must mark it clearly.

Mitigation:

- When Shopify order webhook arrives, detect preorder line items.
- Add Shopify order tag/note/metafield such as `PREORDER`.
- Store preorder line items in backend mapping.
- Create or update Sapo order with note such as `PREORDER - cho hang`.
- Do not create shipping fulfillment until stock is available and warehouse can process it.

#### New stock must be allocated to old preorder orders first

If Sapo imports 10 items and there are 8 preorder items waiting, only 2 items should be available for normal new sales.

Recommended calculation:

```text
available_for_new_sale = sapo_stock - pending_preorder_quantity
```

If `available_for_new_sale > 0`:

- Switch product/variant back to normal `Mua ngay`.

If `available_for_new_sale <= 0`:

- Keep PreOrder enabled or out-of-stock behavior depending on preorder limit.

#### Warehouse and CSKH visibility

Warehouse and customer support need to know which orders are preorder.

Mitigation:

- Add clear tags/notes on Shopify and Sapo orders.
- Add report/filter for pending preorder orders by SKU.
- Add status transitions:
  - `PREORDER_PENDING`
  - `PREORDER_ALLOCATED`
  - `READY_TO_FULFILL`
  - `FULFILLED`

### 2.6 Recommended PreOrder flow

1. Admin marks selected SKU/product as `allow_preorder = true`.
2. Sapo inventory sync runs.
3. If stock = 0 and preorder is allowed:
   - Shopify keeps selling the variant.
   - Product/variant is marked as preorder.
   - Storefront shows `PreOrder`.
4. Payment customization checks the cart.
5. If the cart contains PreOrder:
   - COD is hidden if Shopify/app capability supports it.
   - Customer must use prepaid method.
6. Customer places order.
7. Shopify order webhook enters backend.
8. Backend detects preorder item:
   - marks Shopify/Sapo order as preorder
   - stores pending preorder quantity
   - avoids immediate shipping fulfillment if stock is not available
9. Sapo stock is imported later.
10. Inventory sync calculates stock minus pending preorder quantity.
11. Backend allocates available stock to oldest preorder orders first.
12. Allocated orders become ready for normal warehouse processing.
13. Warehouse creates shipping/VTP tracking in Sapo.
14. Backend syncs completed VTP tracking to Shopify fulfillment.
15. Shopify sends tracking email using `notify_customer = true`.
16. If remaining stock is available for new sale, product returns to `Mua ngay`.

### 2.7 Optimization plan for PreOrder risks

#### Risk: selling more preorder quantity than expected

Problem:

- Shopify `continue selling when out of stock` lets customers keep ordering even when stock is 0.
- Without a preorder limit, the shop can receive more pending orders than the business can supply.

Recommended controls:

- Add a per-SKU preorder setting:
  - `allow_preorder`
  - `preorder_limit`
  - `preorder_pending_qty`
  - `preorder_cutoff_date` if needed
- Calculate remaining preorder capacity:

```text
preorder_remaining_qty = preorder_limit - preorder_pending_qty
```

- Allow PreOrder only when:

```text
allow_preorder = true
and sapo_stock <= 0
and preorder_remaining_qty > 0
```

- Stop PreOrder when `preorder_remaining_qty <= 0`.
- Add admin/report visibility for pending preorder quantity by SKU.

Recommended user-facing behavior:

- If preorder capacity remains: show `PreOrder`.
- If preorder capacity is full: show `Het hang` or `Tam het hang`.

#### Risk: negative Shopify inventory

Problem:

- PreOrder can make Shopify inventory negative.
- Negative stock is not always wrong, but it must be interpreted correctly.

Recommended controls:

- Treat Shopify negative stock as a signal of preorder demand, not as the source of truth.
- Keep Sapo stock as the source of truth for physical inventory.
- Store preorder demand separately in backend:

```text
physical_stock = sapo_stock
preorder_pending_qty = sum(unfulfilled preorder quantities)
available_for_new_sale = physical_stock - preorder_pending_qty
```

- Do not use raw Shopify inventory alone to decide whether an item can return to normal sale.
- Add reconciliation to detect mismatches:
  - Shopify inventory negative but no pending preorder records
  - pending preorder records but Shopify product no longer allows preorder
  - Sapo stock changed but Shopify preorder marker did not update

#### Risk: preorder order does not automatically become a normal order

Problem:

- Shopify does not automatically convert a preorder order into a special normal order later.
- The order is technically a regular Shopify order from the start.
- If the system does not tag and track it, warehouse and CSKH may not know it is waiting for stock.

Recommended controls:

- On Shopify order webhook, detect preorder line items using SKU preorder config and stock state at order time.
- Store preorder metadata internally:
  - Shopify order ID
  - Sapo order ID
  - SKU
  - ordered quantity
  - allocated quantity
  - preorder status
- Add Shopify order tag/metafield:
  - `PREORDER`
  - `PREORDER_PENDING`
- Add Sapo order note:
  - `PREORDER - cho hang`
  - SKU and pending quantity if useful for warehouse
- Do not create Sapo shipping fulfillment until stock is allocated or warehouse confirms ready.

Recommended status transitions:

```text
PREORDER_PENDING -> PREORDER_ALLOCATED -> READY_TO_FULFILL -> FULFILLED
```

#### Risk: new stock and old preorder debt are mixed together

Problem:

- Example: 10 preorder items are waiting, Sapo imports 5.
- If the system sees stock > 0 and immediately switches product to `Mua ngay`, new customers may buy stock that should be allocated to old preorder orders.

Recommended controls:

- Allocate new stock to oldest preorder orders first.
- Use FIFO allocation by order creation time unless business wants manual priority.
- Calculate:

```text
available_for_new_sale = sapo_stock - preorder_pending_qty
```

- If `available_for_new_sale <= 0`:
  - keep product in PreOrder or sold-out state
  - do not switch to normal `Mua ngay`
- If `available_for_new_sale > 0`:
  - switch product back to normal sale
  - set Shopify sellable quantity to `available_for_new_sale`

Allocation example:

```text
sapo_stock = 5
preorder_pending_qty = 10
available_for_new_sale = -5
```

Result:

- Allocate 5 units to oldest preorder orders.
- Keep 5 units still pending.
- Do not return product to normal sale.

Second example:

```text
sapo_stock = 15
preorder_pending_qty = 10
available_for_new_sale = 5
```

Result:

- Allocate 10 units to preorder orders.
- Return 5 units to normal sale.
- Switch storefront from `PreOrder` to `Mua ngay`.

#### Risk: Shopify theme does not change button text

Problem:

- Backend can set inventory policy, tags, or metafields.
- The storefront button text still depends on Shopify theme or a preorder app.

Recommended controls:

- Pick one display mechanism:
  - Theme custom reads product/variant metafield such as `custom.preorder_enabled`.
  - Shopify app reads tag/metafield and controls UI.
- Avoid relying only on inventory quantity because negative inventory can mean preorder or oversell depending on SKU config.
- Recommended storefront condition:

```text
if variant.preorder_enabled = true and variant.inventory_quantity <= 0:
  button = "PreOrder"
else if variant.available:
  button = "Mua ngay"
else:
  button = "Het hang"
```

- Add fallback text on product page:
  - expected restock date
  - preorder policy
  - shipping estimate

#### Risk: customer email and expectation mismatch

Problem:

- Customers may think a PreOrder product ships immediately if the UI/email does not explain it clearly.
- This can increase cancellation/support requests.

Recommended controls:

- Product page should show clear preorder wording before checkout.
- Cart/checkout line item should include preorder note if theme/app supports it.
- Shopify order confirmation email should include preorder message.
- Sapo/warehouse note should say the order is waiting for stock.
- Tracking email should only be sent when real shipping fulfillment is created with VTP tracking.

Recommended message content:

- Product page/button:
  - `PreOrder`
  - `Hang dat truoc, giao sau khi co hang`
- Order note/email:
  - `San pham nay la hang dat truoc. Shop se thong bao khi don duoc ban giao van chuyen.`
- Tracking email:
  - Sent by Shopify when backend creates fulfillment with `notify_customer = true`.

#### Recommended minimal data model

For selected-SKU PreOrder, store at least:

```text
sku
allow_preorder
preorder_limit
preorder_pending_qty
preorder_allocated_qty
preorder_status
expected_restock_date
```

For each preorder order item:

```text
shopify_order_id
sapo_order_id
sku
quantity
allocated_quantity
status
created_at
allocated_at
fulfilled_at
```

This avoids depending on Shopify negative inventory as the only signal.

### 2.8 PreOrder test cases

- SKU not allowed for preorder, Sapo stock = 0: Shopify should not sell.
- SKU allowed for preorder, Sapo stock = 0: Shopify should sell and show PreOrder.
- SKU allowed for preorder, Sapo stock becomes > 0 and no pending preorder: product returns to Mua ngay.
- SKU allowed for preorder, Sapo stock becomes > 0 but pending preorder consumes all stock: product should not return to normal sale yet.
- Normal product cart: COD remains visible if Shopify/payment app supports the rule.
- PreOrder cart: COD is hidden if Shopify/payment app supports the rule.
- Mixed normal + PreOrder cart: COD is hidden for the whole checkout, or cart is blocked, depending on final business rule.
- PreOrder order paid by manual bank transfer: system must not treat it as shipped/ready just because the order exists.
- PreOrder order is tagged/noted correctly in Shopify and Sapo.
- PreOrder order is not shipped before allocation.
- When VTP tracking appears, Shopify fulfillment is created once and customer email is sent.
- PreOrder limit reached: storefront should stop accepting preorder.
- Shopify inventory negative but pending preorder records exist: system should treat it as expected preorder debt.
- Shopify inventory negative without matching preorder records: reconciliation should flag mismatch.
- Sapo imports partial stock: oldest preorder orders should be allocated first.
- Sapo imports enough stock for all pending preorder and extra quantity: remaining quantity should return to normal sale.
- Theme/app receives preorder metafield/tag update and changes button text correctly.
- Order confirmation content clearly communicates preorder status.

Risk level: high if inventory allocation is included. Medium if only simple per-SKU preorder display is implemented.

## 3. Estimated Implementation Effort

Tracking and email:

- Estimated time: 0.5-1 day.
- Main risk: duplicate fulfillment and wrong tracking code.

Voucher/discount/shipping fee:

- Estimated time: 1 day.
- Main risk: money total mismatch between Shopify and Sapo.

Order notes:

- Estimated time: 0.25-0.5 day.
- Main risk: overwriting manual notes.

Simple PreOrder per selected SKU:

- Estimated time: 1-2 days if theme/app integration is simple.
- Main risk: storefront display and inventory policy behavior.

PreOrder with queue/allocation:

- Estimated time: 3-5 days depending on current data model and admin control needs.
- Main risk: stock allocation correctness and operational workflow.

## 4. Recommended Priority

1. Fix/extend VTP tracking reconciliation for Shopify fulfillment.
2. Confirm Shopify email notification behavior with `notify_customer = true`.
3. Normalize voucher/discount/shipping fee mapping.
4. Add order note mapping rules.
5. Add simple per-SKU PreOrder flag.
6. Add preorder queue/allocation only if business needs strict stock reservation.
