# PreOrder Pre-Feature Checklist

Date: 2026-08-22

Scope: planning/checklist only. This file does not include production code changes.

## 1. Goal

- Build a simple PreOrder flow for selected Shopify products/SKUs only.
- Do not enable PreOrder for the whole shop.
- Keep Sapo as the source of truth for physical stock.
- Allow customers to order selected out-of-stock products when PreOrder is enabled.
- Require prepaid payment for PreOrder if Shopify checkout/app capability supports it.
- Keep COD available for normal products.
- Prevent normal sale from consuming stock that should be allocated to old PreOrder orders.

## 2. Confirm Current Constraints

- [ ] Confirm Fitme Shopify plan is still `basic`.
- [ ] Confirm the current backend Shopify app is not a Shopify Function extension.
- [ ] Confirm current backend has no `paymentMethodHide` checkout logic.
- [ ] Confirm current backend can update Shopify product/variant tags or metafields.
- [ ] Confirm current backend can update Shopify inventory policy.
- [ ] Confirm current backend can tag/note Shopify orders.
- [ ] Confirm current backend can write Sapo order notes.
- [ ] Confirm Shopify theme can read product/variant tag or metafield.
- [ ] Confirm whether Shopify Admin/app can hide COD for non-Plus store.

## 3. PreOrder Product/SKU Setup

- [ ] Add a selected product/SKU allowlist for PreOrder.
- [ ] Store `allow_preorder` per SKU or per Shopify variant.
- [ ] Store `preorder_limit` per SKU if business wants a max preorder quantity.
- [ ] Store `expected_restock_date` if customer-facing restock wording is needed.
- [ ] Make sure products not in the allowlist never become PreOrder automatically.
- [ ] Make sure PreOrder can be turned on/off per product/SKU without affecting other SKUs.

Recommended fields:

```text
sku
shopify_product_id
shopify_variant_id
allow_preorder
preorder_limit
preorder_pending_qty
preorder_allocated_qty
expected_restock_date
status
```

## 4. Inventory Sync Rules

- [ ] If Sapo stock > 0 and no pending PreOrder debt: Shopify sells normally.
- [ ] If Sapo stock = 0 and `allow_preorder = true`: Shopify allows selling out of stock.
- [ ] If Sapo stock = 0 and `allow_preorder = false`: Shopify does not allow selling out of stock.
- [ ] If pending PreOrder quantity exists, calculate stock available for normal sale.
- [ ] Do not use raw Shopify negative inventory as the only source of truth.

Recommended calculation:

```text
available_for_new_sale = sapo_stock - preorder_pending_qty
```

Rules:

- [ ] If `available_for_new_sale > 0`: product can return to normal `Mua ngay`.
- [ ] If `available_for_new_sale <= 0` and preorder capacity remains: keep `PreOrder`.
- [ ] If `available_for_new_sale <= 0` and preorder capacity is full: show `Het hang` or `Tam het hang`.

## 5. PreOrder Limit Rules

- [ ] Track pending PreOrder quantity per SKU.
- [ ] Track allocated PreOrder quantity per SKU.
- [ ] Stop accepting PreOrder when the limit is reached.
- [ ] Support no-limit only if business explicitly accepts overselling risk.

Recommended calculation:

```text
preorder_remaining_qty = preorder_limit - preorder_pending_qty
```

Allow PreOrder only when:

```text
allow_preorder = true
and sapo_stock <= 0
and preorder_remaining_qty > 0
```

## 6. Shopify Storefront Behavior

- [ ] Product page shows `PreOrder` only for selected SKU/variant.
- [ ] Normal in-stock products show `Mua ngay`.
- [ ] Out-of-stock products without PreOrder show `Het hang` or `Tam het hang`.
- [ ] Product page clearly explains this is preorder stock.
- [ ] Cart line item shows PreOrder note if theme/app supports it.
- [ ] Checkout/order confirmation wording does not imply immediate shipment.

Recommended storefront condition:

```text
if variant.preorder_enabled = true and variant.inventory_quantity <= 0:
  button = "PreOrder"
else if variant.available:
  button = "Mua ngay"
else:
  button = "Het hang"
```

Recommended customer-facing text:

```text
Hang dat truoc, giao sau khi co hang.
Shop se thong bao khi don duoc ban giao van chuyen.
```

## 7. Payment / COD Rule

Target behavior:

- [ ] Cart with only normal products: COD remains visible.
- [ ] Cart with any PreOrder item: COD is hidden or blocked.
- [ ] Cart with normal + PreOrder items: apply one final business rule.

Recommended mixed-cart rule:

- [ ] If any item is PreOrder, hide COD for the whole cart.

Alternative mixed-cart rule:

- [ ] Block mixed cart and ask customer to checkout PreOrder separately.

Important Shopify limitation:

- Backend can detect PreOrder after order creation.
- Backend cannot reliably hide COD inside Shopify checkout by itself.
- COD hiding must be handled by Shopify Payment Customization, Shopify Function, or a compatible Shopify app.
- On Shopify Basic/non-Plus, a custom-code-only payment function may not be available depending on Shopify/app permissions.
- Public Shopify apps may support payment method hiding for non-Plus stores; this must be verified before implementation.

Payment checklist:

- [ ] Verify available Shopify app/function option for hiding COD on Fitme Basic plan.
- [ ] Verify app/function can read product tag or variant metafield.
- [ ] Verify app/function can hide COD when cart has PreOrder.
- [ ] Verify app/function keeps COD for normal products.
- [ ] Verify accelerated checkout behavior.
- [ ] Verify manual bank transfer status does not falsely mean the order is fully paid.

## 8. Shopify Order Handling

- [ ] On Shopify order webhook, detect whether any line item is PreOrder.
- [ ] Add Shopify order tag such as `PREORDER`.
- [ ] Add Shopify order tag such as `PREORDER_PENDING`.
- [ ] Store PreOrder line item details in backend.
- [ ] Store Shopify order ID, Sapo order ID, SKU, quantity, allocated quantity, and status.
- [ ] Do not create shipping fulfillment before stock allocation.
- [ ] Do not send tracking email until real fulfillment with VTP tracking exists.

Recommended status flow:

```text
PREORDER_PENDING -> PREORDER_ALLOCATED -> READY_TO_FULFILL -> FULFILLED
```

## 9. Sapo Order Handling

- [ ] Sync PreOrder Shopify order to Sapo normally if business wants warehouse visibility.
- [ ] Add Sapo order note: `PREORDER - cho hang`.
- [ ] Include SKU and pending quantity in Sapo note if useful for warehouse.
- [ ] Avoid creating shipping fulfillment until stock is allocated or warehouse confirms ready.
- [ ] Preserve manual warehouse notes after order creation.
- [ ] Keep Sapo physical stock as the source of truth.

## 10. Allocation When Sapo Imports Stock

- [ ] Allocate new stock to oldest PreOrder orders first.
- [ ] Use FIFO allocation by order creation time unless business defines another priority.
- [ ] Partial stock import should partially allocate old PreOrder demand.
- [ ] Do not switch product to normal sale until remaining stock is available after PreOrder allocation.

Example 1:

```text
sapo_stock = 5
preorder_pending_qty = 10
available_for_new_sale = -5
```

Expected result:

- [ ] Allocate 5 units to oldest PreOrder orders.
- [ ] Keep 5 units pending.
- [ ] Do not return product to normal sale.

Example 2:

```text
sapo_stock = 15
preorder_pending_qty = 10
available_for_new_sale = 5
```

Expected result:

- [ ] Allocate 10 units to PreOrder orders.
- [ ] Return 5 units to normal sale.
- [ ] Switch storefront from `PreOrder` to `Mua ngay`.

## 11. Viettel Post Tracking and Customer Email

- [ ] Keep existing rule: no fallback to uncompleted Sapo `tracking_code`.
- [ ] Only sync real VTP tracking when Sapo shipment has completed/valid tracking status.
- [ ] Shopify fulfillment must use the real Viettel Post tracking code, not packing code.
- [ ] Shopify fulfillment should set `notify_customer = true`.
- [ ] Shopify sends tracking email after fulfillment is created.
- [ ] Tracking email should not be sent before real VTP tracking exists.

## 12. Voucher, Discount, Shipping Fee, and Notes

- [ ] Confirm Shopify voucher/discount maps correctly to Sapo.
- [ ] Confirm Shopify shipping fee maps correctly to Sapo.
- [ ] Confirm free shipping voucher behavior.
- [ ] Confirm line-level discount behavior.
- [ ] Confirm order-level discount behavior.
- [ ] Confirm Shopify order note maps to Sapo note.
- [ ] Confirm Shopify note attributes map to Sapo note if required.
- [ ] Confirm generated notes do not overwrite manual warehouse notes.

## 13. Reporting / Operations

- [ ] Add view/report for pending PreOrder by SKU.
- [ ] Add view/report for allocated PreOrder by SKU.
- [ ] Add mismatch report for Shopify negative inventory without PreOrder record.
- [ ] Add mismatch report for PreOrder record but Shopify product no longer allows preorder.
- [ ] Add mismatch report for Sapo stock changed but Shopify PreOrder marker did not update.
- [ ] Add operational filter for `PREORDER_PENDING`.
- [ ] Add operational filter for `PREORDER_ALLOCATED`.
- [ ] Add operational filter for `READY_TO_FULFILL`.

## 14. Test Checklist

- [ ] SKU not allowed for PreOrder, Sapo stock = 0: Shopify should not sell.
- [ ] SKU allowed for PreOrder, Sapo stock = 0: Shopify should sell and show `PreOrder`.
- [ ] SKU allowed for PreOrder, Sapo stock becomes > 0 and no pending PreOrder: product returns to `Mua ngay`.
- [ ] SKU allowed for PreOrder, Sapo stock becomes > 0 but pending PreOrder consumes all stock: product does not return to normal sale.
- [ ] PreOrder limit reached: storefront stops accepting PreOrder.
- [ ] Shopify inventory negative with matching PreOrder records: system treats it as expected PreOrder debt.
- [ ] Shopify inventory negative without matching PreOrder records: system flags mismatch.
- [ ] Cart only normal products: COD remains visible.
- [ ] Cart only PreOrder products: COD is hidden if Shopify/app capability supports it.
- [ ] Cart normal + PreOrder products: COD is hidden or cart is blocked according to final business rule.
- [ ] PreOrder order is tagged/noted in Shopify.
- [ ] PreOrder order is noted in Sapo.
- [ ] PreOrder order is not shipped before stock allocation.
- [ ] Manual bank transfer order is not treated as fully paid until payment is confirmed.
- [ ] Sapo imports partial stock: oldest PreOrder orders are allocated first.
- [ ] Sapo imports enough stock for all PreOrder and extra quantity: remaining quantity returns to normal sale.
- [ ] VTP tracking appears in Sapo: Shopify fulfillment is created once.
- [ ] Shopify sends customer tracking email after fulfillment.
- [ ] Fulfilled Shopify order is not fulfilled twice.
- [ ] Cancelled Shopify/Sapo order is not fulfilled.

## 15. Recommended Implementation Order

1. Confirm Shopify payment customization/app capability on Basic plan.
2. Add selected SKU/product PreOrder allowlist.
3. Add Shopify tag/metafield update for PreOrder variants.
4. Add theme/app display rule for `PreOrder` button.
5. Add order detection, Shopify/Sapo tags, and Sapo note.
6. Add PreOrder pending quantity tracking.
7. Add allocation logic when Sapo stock is imported.
8. Add limit handling.
9. Add COD hiding through Shopify app/function if available.
10. Add reports/reconciliation for stock and PreOrder mismatches.
11. Verify VTP tracking fulfillment and Shopify customer email.
12. Verify voucher, shipping fee, discount, and note sync.

## 16. Estimated Effort

- Simple selected-SKU PreOrder marker and storefront display: 1-2 days if theme/app integration is straightforward.
- Payment/COD control: depends on Shopify Basic app/function capability; estimate 0.5-2 days after confirming available app/function.
- PreOrder order tagging and Sapo note: 0.5-1 day.
- Pending quantity and allocation logic: 2-4 days.
- Reporting/reconciliation: 1-2 days.
- Full end-to-end testing: 1-2 days.

Highest-risk areas:

- Payment/COD hiding on Shopify Basic.
- Inventory allocation when Sapo imports partial stock.
- Preventing normal sale from consuming stock reserved for old PreOrder orders.
- Avoiding duplicate Shopify fulfillment/tracking emails.
