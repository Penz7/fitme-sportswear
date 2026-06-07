export type ProductPlatform = 'sapo' | 'pancake' | 'shopify';

export type ProductConflictType =
  | 'duplicate_sapo_sku'
  | 'duplicate_pancake_sku'
  | 'duplicate_shopify_sku'
  | 'ambiguous_mapping'
  | 'multiple_pancake_warehouses';

export interface ProductConflictDetail {
  type: ProductConflictType;
  platform: ProductPlatform | 'mapping';
  message: string;
  sapoVariantCount: number;
  pancakeVariantCount: number;
  shopifyVariantCount: number;
  entries: Array<{
    platform: ProductPlatform;
    sku: string;
    productId: string | null;
    variantId: string | null;
    warehouseId: string | null;
    name: string | null;
  }>;
}

export interface PlatformProductSnapshot {
  platform: ProductPlatform;
  sku: string;
  normalizedSku: string;
  productId: string | null;
  variantId: string | null;
  name: string | null;
  available: number | null;
  remain: number | null;
  retailPrice: number | null;
  warehouseId: string | null;
  warehouseCount: number | null;
  sourceUpdatedAt?: Date | null;
}

export interface ProductMappingCandidate {
  sku: string;
  normalizedSku: string;
  sapo: PlatformProductSnapshot | null;
  pancake: PlatformProductSnapshot | null;
  shopify: PlatformProductSnapshot | null;
  status: 'matched' | 'partial' | 'conflict';
  conflictReason: string | null;
  conflictDetail: ProductConflictDetail | null;
}
