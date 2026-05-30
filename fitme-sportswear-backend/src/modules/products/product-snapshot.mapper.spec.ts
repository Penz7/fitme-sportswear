import {
  mapPancakeProductSnapshot,
  mapSapoProductSnapshot,
  mapShopifyProductSnapshots,
} from './product-snapshot.mapper';

describe('product snapshot mapper', () => {
  it('maps Sapo variant and sums inventory availability', () => {
    const result = mapSapoProductSnapshot({
      id: 10,
      name: 'Áo chạy bộ',
      variants: [
        {
          id: 20,
          sku: 'SKU-1',
          variantRetailPrice: 150000,
          inventories: [
            { available: 2, onHand: 3 },
            { available: 4, onHand: 5 },
          ],
        },
      ],
    });
    expect(result).toEqual([{ platform: 'sapo', sku: 'SKU-1', productId: '10', variantId: '20', name: 'Áo chạy bộ', available: 6, remain: 8, retailPrice: 150000, warehouseId: null }]);
  });

  it('maps Pancake displayId as SKU and sums warehouse quantities', () => {
    const result = mapPancakeProductSnapshot({
      displayId: 'SKU-2', productId: 'p-1', id: 'v-1', product: { name: 'Quần tập' }, retailPrice: '200000',
      variationsWarehouses: [
        { warehouseId: 'w-1', remainQuantity: 7, actualRemainQuantity: 9 },
        { warehouseId: 'w-2', remainQuantity: 3, actualRemainQuantity: 5 },
      ],
    });
    expect(result).toEqual({ platform: 'pancake', sku: 'SKU-2', productId: 'p-1', variantId: 'v-1', name: 'Quần tập', available: 10, remain: 14, retailPrice: 200000, warehouseId: 'w-1' });
  });

  it('maps Shopify variants with SKU', () => {
    const result = mapShopifyProductSnapshots({
      id: 'shop-product-1', title: 'Giày chạy',
      variants: [{ id: 'variant-1', sku: 'SKU-3', title: 'Size 40', available: 11, inventoryQuantity: 12, price: '350000' }],
    });
    expect(result).toEqual([{ platform: 'shopify', sku: 'SKU-3', productId: 'shop-product-1', variantId: 'variant-1', name: 'Giày chạy - Size 40', available: 11, remain: 12, retailPrice: 350000, warehouseId: null }]);
  });

  it('drops products without usable SKU', () => {
    expect(mapSapoProductSnapshot({ id: 1, name: 'No SKU', variants: [{ id: 2, sku: '', inventories: [] }] })).toEqual([]);
    expect(mapPancakeProductSnapshot({ displayId: '', id: 'v', productId: 'p' })).toBeNull();
    expect(mapShopifyProductSnapshots({ id: 'p', title: 'No SKU', variants: [{ id: 'v', sku: '' }] })).toEqual([]);
  });
});
