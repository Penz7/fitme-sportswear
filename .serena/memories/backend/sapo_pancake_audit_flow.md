# Sapo - Pancake audit flow

Source: `SAPO_SYNC_PANCAKE.md`.

When auditing the new backend, verify the Sapo - Pancake workflow against this flow:

- Pancake sync scope:
  - Product SKU sync.
  - Customer information sync.
  - Order status sync.
  - Inventory sync.
  - Order note sync.
- Step 1: Order is created on Pancake and confirmed.
  - Pancake sends order data to Sapo through the backend.
  - Backend creates or updates the corresponding Sapo order.
  - Inventory is reduced according to the order flow.
  - Order status metadata is updated.
- Step 2: Warehouse updates the order status and prepares carrier handoff.
  - After warehouse packing/export handling, Pancake moves to packed/packing status.
  - Backend should map the warehouse/Sapo state to the proper Pancake status.
- Step 3: Carrier picks up the goods.
  - Sapo moves to exported/shipped stock state.
  - Pancake moves to shipped status.
- Step 4: Customer receives the goods.
  - Carrier delivery success can make Pancake auto-move to received or money-collected status.
  - Backend should reflect that status back to Sapo according to status mapping rules.
- Continuous operation:
  - Sapo and Pancake continuously update product SKUs and inventory.
  - When there are orders from other sales channels or new stock inbound, inventory sync must keep Sapo and Pancake consistent.

Audit focus:

- Confirm Pancake webhook ingestion covers order create/update events.
- Confirm Pancake-created orders create/update Sapo orders.
- Confirm status mappings cover confirmed, packing, shipped, received, money collected, canceled, and returned states.
- Confirm inventory behavior is not double-counted between order events and product inventory sync.
- Confirm SKU matching is stable and rejects ambiguous/missing SKU mappings.
- Confirm customer and order notes are preserved when syncing from Pancake to Sapo.
