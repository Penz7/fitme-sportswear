# Pancake Composite Combo Create Design

## Context

The current Sapo-to-Pancake product creation logic can detect combo SKUs and
prevent them from being created as ordinary Pancake products. The required
behavior is now different: when Sapo has a new combo SKU, Pancake should also
receive a combo product, but it must be created as a Pancake composite product
instead of a normal product with manually assigned inventory.

Live Pancake API inspection shows that normal products expose these fields:

- `is_composite`
- `composite_products`
- `bonus_variations`

The Pancake API documentation exposes a composite endpoint:

`POST /shops/{SHOP_ID}/variations/update_composite_product`

This means combo creation is a two-step operation:

1. Create the Pancake product/variation.
2. Configure that variation as a composite with component variation IDs.

## Combo Data Rule

Combo SKUs follow the Excel format provided by the business:

- Each combo has exactly two component SKUs.
- Component quantities are both `1`.
- The second component starts at the second `FM-` marker in the SKU.

Example:

`FM-AVBNU-XR-S-FM-QNTG01-DE-S`

Components:

- `FM-AVBNU-XR-S`, quantity `1`
- `FM-QNTG01-DE-S`, quantity `1`

If a SKU does not match this structure, it is not eligible for automatic
composite creation.

## Goal

When Sapo has a new combo SKU missing from Pancake, automatically create a
Pancake composite product only when both component SKUs already exist on
Pancake. Do not create the combo as a normal inventory-managed product.

## Required Behavior

### Missing Combo With Both Components Available On Pancake

When the Sapo combo SKU is missing from Pancake and both component SKUs exist
on Pancake:

- Create the Pancake product/variation for the combo SKU.
- Do not set combo inventory directly as an independent stock source.
- Call Pancake `update_composite_product` for the newly created variation.
- Configure each component variation with quantity `1`.
- Store local `pancake_products` and `product_mappings` records for the combo.
- Count it separately from ordinary product creation.

### Missing Combo With Missing Component

When one or both component SKUs do not exist on Pancake:

- Do not create the combo product.
- Record the combo as skipped due to missing components.
- Include the missing component SKUs in metadata/Telegram summary.
- Continue processing other SKUs.

### Existing Combo On Pancake

When a combo SKU already exists on Pancake:

- Do not recreate or overwrite it.
- Continue ordinary inventory comparison behavior only if Pancake exposes
  inventory for the combo variation.
- Do not force direct inventory updates for a combo unless the current sync
  already treats the existing Pancake variation as updateable.

### Ordinary SKU

Ordinary SKU creation remains unchanged.

## Pancake Client API

Add a Pancake client method for composite configuration:

```typescript
updateCompositeProduct(input: {
  comboVariantId: string;
  components: Array<{
    variationId: string;
    quantity: number;
  }>;
}): Promise<void>;
```

The method must:

- Use the shop-scoped Pancake API endpoint.
- Use the existing product request timeout/retry path.
- Throw a clear error for non-2xx responses.

The exact request payload should be derived from Pancake API documentation and
verified with a small test around the client method before runtime testing.

## Sync Metadata

Extend Sapo-to-Pancake inventory sync metadata with:

- `createdCompositePancake`
- `createdCompositePancakeSkus`
- `skippedCompositeMissingComponents`
- `skippedCompositeMissingComponentSkus`

Telegram summary must include those fields.

Composite creation failures are real sync errors and should appear in
`errors`. Missing components are not errors; they are safe skips.

## Safety Rules

- Never create a combo as an ordinary Pancake product if component resolution
  fails.
- Never infer component quantity other than `1` under the current rule.
- Never create component SKUs automatically as part of combo creation.
- Never update Sapo from Pancake.
- Do not affect order webhook behavior.
- Keep backend stopped during implementation and verification.

## Testing

Add tests for:

1. Splitting a combo SKU into two component SKUs.
2. Rejecting malformed combo SKUs.
3. Pancake composite API client payload and error handling.
4. Creating a missing combo when both component SKUs exist on Pancake.
5. Skipping a missing combo when one component is absent.
6. Keeping ordinary SKU creation unchanged.
7. Preserving existing combo inventory behavior.
8. Telegram summary includes composite create/skip counters.

## Rollout

1. Implement and verify with unit tests.
2. Build backend.
3. Keep runtime stopped until manual approval.
4. Test with a single known combo SKU in targeted sync.
5. Confirm on Pancake that:
   - the product exists,
   - `is_composite=true`,
   - `composite_products` contains both component variations.

