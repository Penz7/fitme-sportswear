export type ProductPlatform = 'sapo' | 'pancake' | 'shopify';

export interface PlatformProductSnapshot {
  platform: ProductPlatform;
  sku: string;
  productId: string | null;
  variantId: string | null;
  name: string | null;
  available: number | null;
  remain: number | null;
  retailPrice: number | null;
  warehouseId: string | null;
}

export interface ProductMappingCandidate {
  sku: string;
  sapo: PlatformProductSnapshot | null;
  pancake: PlatformProductSnapshot | null;
  shopify: PlatformProductSnapshot | null;
  status: 'matched' | 'partial' | 'conflict';
  conflictReason: string | null;
}
