import { PlatformProductSnapshot } from './types/platform-product-snapshot';
import { normalizeSku } from './sku-normalizer';

interface SapoInventoryInput {
  available?: number | null;
  onHand?: number | null;
}

interface SapoVariantInput {
  id?: string | number | null;
  sku?: string | null;
  variantRetailPrice?: number | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  modifiedOn?: string | null;
  modified_on?: string | null;
  inventories?: SapoInventoryInput[] | null;
}

interface SapoProductInput {
  id?: string | number | null;
  name?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  modifiedOn?: string | null;
  modified_on?: string | null;
  variants?: SapoVariantInput[] | null;
}

interface PancakeWarehouseInput {
  warehouseId?: string | null;
  remainQuantity?: number | null;
  actualRemainQuantity?: number | null;
}

interface PancakeProductInput {
  displayId?: string | null;
  productId?: string | number | null;
  id?: string | number | null;
  product?: { name?: string | null } | null;
  retailPrice?: string | number | null;
  variationsWarehouses?: PancakeWarehouseInput[] | null;
}

interface ShopifyVariantInput {
  id?: string | number | null;
  sku?: string | null;
  title?: string | null;
  available?: number | null;
  inventoryQuantity?: number | null;
  price?: string | number | null;
}

interface ShopifyProductInput {
  id?: string | number | null;
  title?: string | null;
  variants?: ShopifyVariantInput[] | null;
}

const toNullableString = (value: string | number | null | undefined): string | null =>
  value === null || value === undefined ? null : String(value);

const toNullableNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const sumValues = <T>(items: T[] | null | undefined, getValue: (item: T) => number | null | undefined): number =>
  (items ?? []).reduce((sum, item) => sum + (getValue(item) ?? 0), 0);

const toNullableDate = (...values: Array<string | null | undefined>): Date | null => {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

export const mapSapoProductSnapshot = (product: SapoProductInput): PlatformProductSnapshot[] =>
  (product.variants ?? [])
    .map((variant): PlatformProductSnapshot | null => {
      const sku = variant.sku?.trim();
      if (!sku) {
        return null;
      }

      return {
        platform: 'sapo',
        sku,
        normalizedSku: normalizeSku(sku),
        productId: toNullableString(product.id),
        variantId: toNullableString(variant.id),
        name: product.name ?? null,
        available: sumValues(variant.inventories, (inventory) => inventory.available),
        remain: sumValues(variant.inventories, (inventory) => inventory.onHand),
        retailPrice: variant.variantRetailPrice ?? null,
        warehouseId: null,
        warehouseCount: null,
        sourceUpdatedAt: toNullableDate(
          variant.updatedAt,
          variant.updated_at,
          variant.modifiedOn,
          variant.modified_on,
          product.updatedAt,
          product.updated_at,
          product.modifiedOn,
          product.modified_on,
        ),
      };
    })
    .filter((snapshot): snapshot is PlatformProductSnapshot => snapshot !== null);

export const mapPancakeProductSnapshot = (product: PancakeProductInput): PlatformProductSnapshot | null => {
  const sku = product.displayId?.trim();
  if (!sku) {
    return null;
  }

  const warehouses = product.variationsWarehouses ?? [];

  return {
    platform: 'pancake',
    sku,
    normalizedSku: normalizeSku(sku),
    productId: toNullableString(product.productId),
    variantId: toNullableString(product.id),
    name: product.product?.name ?? null,
    available: sumValues(warehouses, (warehouse) => warehouse.remainQuantity),
    remain: sumValues(warehouses, (warehouse) => warehouse.actualRemainQuantity),
    retailPrice: toNullableNumber(product.retailPrice),
    warehouseId: warehouses[0]?.warehouseId ?? null,
    warehouseCount: warehouses.length,
  };
};

export const mapShopifyProductSnapshots = (product: ShopifyProductInput): PlatformProductSnapshot[] =>
  (product.variants ?? [])
    .map((variant): PlatformProductSnapshot | null => {
      const sku = variant.sku?.trim();
      if (!sku) {
        return null;
      }

      return {
        platform: 'shopify',
        sku,
        normalizedSku: normalizeSku(sku),
        productId: toNullableString(product.id),
        variantId: toNullableString(variant.id),
        name: [product.title, variant.title].filter(Boolean).join(' - ').trim() || null,
        available: variant.available ?? variant.inventoryQuantity ?? null,
        remain: variant.inventoryQuantity ?? variant.available ?? null,
        retailPrice: toNullableNumber(variant.price),
        warehouseId: null,
        warehouseCount: null,
      };
    })
    .filter((snapshot): snapshot is PlatformProductSnapshot => snapshot !== null);
