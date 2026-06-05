# Pancake Webhook Order Sample 17993

Captured at: 2026-06-05 06:50:37 UTC

## Webhook

- webhookEventId: `7bb3b61c-5e6d-433c-8d3a-8c4635a270f4`
- eventType: `order_created`
- externalEventId: `17993`
- payload.id: `17993`
- payload.system_id: `17993`
- payload.type: `orders`
- payload.event_type: `create`
- payload.status: `0`
- payload.status_name: `new`
- payload.note: `WEBHOOK_TEST`
- payload.note_print: `WEBHOOK_TEST`

## Customer

- bill_full_name: `Ms. Kieu Anh`
- bill_phone_number: `0973046408`
- customer.id: `c4a93de3-0eaa-4fac-9b3d-144741683ffa`
- customer.customer_id: `5b017fd0-e097-404b-93df-74a274c215ed`
- customer.name: `Ms. Kieu Anh`

## Shipping Address

- full_name: `Ms. Kieu Anh`
- phone_number: `0973046408`
- address: `Khu cong nghiep Chon Thanh II`
- full_address: `Khu cong nghiep Chon Thanh II, Xa Thanh Tam, Thi xa Chon Thanh, Binh Phuoc`
- province_id: `707`
- province_name: `Binh Phuoc`
- district_id: `70708`
- district_name: `Thi xa Chon Thanh`
- commune_id: `7070802`
- commune_name: `Xa Thanh Tam`

## Item

- items_length: `1`
- item.id: `12526355095`
- quantity: `1`
- product_id: `7addbbb4-c30d-4565-b60c-5a2530c24359`
- variation_id: `9d2b0a4c-1699-4bbe-8b3c-ab0359f496d5`
- sku/barcode: `FM-BRTT01-LG-XL`
- display_id: `FM-BRTT01-LG-XL`
- product_display_id: `1010`
- name: `Ao bra tap gym yoga nu Fitme Theta co mut chong soc. nang nguc chat thun the thao cao cap co gian thoai mai BRTT#FM-BRTT01-LG-XL`
- detail: `SIZE: XL, MAU SAC: Light Grey`
- retail_price: `199000`
- total_discount: `0`

## Payment

- total_price: `199000`
- total_price_after_sub_discount: `199000`
- total_quantity: `1`
- cod: `199000`
- cash: `0`
- prepaid: `0`
- transfer_money: `0`
- shipping_fee: `0`
- total_discount: `0`
- money_to_collect: `199000`
- order_currency: `VND`

## Shop And Warehouse

- shop_id: `1290216695`
- page.id: `103914074304586`
- page.name: `Fitme Sportswear`
- page.username: `fitme.vn`
- warehouse_id: `fac0018d-348c-43a4-8d86-c2fb175b4fee`
- warehouse_info.name: `Kho mac dinh`
- warehouse_info.full_address: `99A PHAM VAN SANG, Xa Xuan Thoi Thuong, Huyen Hoc Mon, Ho Chi Minh`

## Sapo Mapping Notes

- Sapo order code should use a deterministic code such as `AUTO_PANCAKE_17993`.
- Use `bill_phone_number` or `shipping_address.phone_number` for customer lookup.
- Use `shipping_address.full_address` plus mapped province/district/ward when available.
- Use `items[].variation_info.barcode` as SKU.
- Use `items[].quantity` as quantity.
- Use `items[].variation_info.retail_price` as line price.
- Use `prepaid > 0` to create Sapo prepayment.
- Do not process this order unless `note` or `note_print` contains `WEBHOOK_TEST` during test mode.
