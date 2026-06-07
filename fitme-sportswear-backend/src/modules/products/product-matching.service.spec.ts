import { ProductMatchingService } from './product-matching.service';
import { PlatformProductSnapshot } from './types/platform-product-snapshot';

function snapshot(
  platform: PlatformProductSnapshot['platform'],
  sku: string,
): PlatformProductSnapshot {
  return {
    platform,
    sku,
    normalizedSku: sku.trim().toUpperCase(),
    productId: `${platform}-product`,
    variantId: `${platform}-variant`,
    name: `${platform} ${sku}`,
    available: 5,
    remain: 5,
    retailPrice: 100000,
    warehouseId: platform === 'pancake' ? 'warehouse-1' : null,
    warehouseCount: platform === 'pancake' ? 1 : null,
  };
}

describe('ProductMatchingService', () => {
  const service = new ProductMatchingService();

  it('marks SKU with Sapo and receiving platform as matched', () => {
    const result = service.buildMappings([
      snapshot('sapo', 'SKU-1'),
      snapshot('pancake', 'SKU-1'),
      snapshot('shopify', 'SKU-1'),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: 'SKU-1',
      status: 'matched',
      conflictReason: null,
    });
  });

  it('matches SKU case-insensitively using normalizedSku', () => {
    const sapo = snapshot('sapo', ' abc-1 ');
    sapo.normalizedSku = 'ABC-1';
    const pancake = snapshot('pancake', 'ABC-1');
    pancake.normalizedSku = 'ABC-1';

    const result = service.buildMappings([sapo, pancake]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: ' abc-1 ',
      normalizedSku: 'ABC-1',
      status: 'matched',
    });
  });

  it('marks SKU with only Sapo as partial', () => {
    const result = service.buildMappings([snapshot('sapo', 'SKU-2')]);

    expect(result[0]).toMatchObject({
      sku: 'SKU-2',
      status: 'partial',
      conflictReason: 'Missing Pancake and Shopify records',
    });
  });

  it('marks duplicate SKU in one platform as conflict', () => {
    const result = service.buildMappings([
      snapshot('sapo', 'SKU-3'),
      snapshot('pancake', 'SKU-3'),
      snapshot('pancake', 'SKU-3'),
    ]);

    expect(result[0]).toMatchObject({
      sku: 'SKU-3',
      status: 'conflict',
    });
    expect(result[0].conflictReason).toContain('Duplicate SKU in pancake');
    expect(result[0].conflictReason).toContain('product=pancake-product');
    expect(result[0].conflictReason).toContain('variant=pancake-variant');
    expect(result[0].conflictReason).toContain('warehouse=warehouse-1');
  });

  it('marks duplicate Sapo normalized SKU as duplicate_sapo_sku conflict', () => {
    const one = snapshot('sapo', 'SKU-6');
    one.productId = 'sapo-product-1';
    one.variantId = 'sapo-variant-1';
    const two = snapshot('sapo', ' sku-6 ');
    two.normalizedSku = 'SKU-6';
    two.productId = 'sapo-product-2';
    two.variantId = 'sapo-variant-2';

    const result = service.buildMappings([
      one,
      two,
      snapshot('pancake', 'SKU-6'),
    ]);

    expect(result[0].status).toBe('conflict');
    expect(result[0].conflictDetail).toMatchObject({
      type: 'duplicate_sapo_sku',
      platform: 'sapo',
      sapoVariantCount: 2,
      pancakeVariantCount: 1,
      shopifyVariantCount: 0,
      entries: expect.arrayContaining([
        expect.objectContaining({
          platform: 'sapo',
          sku: 'SKU-6',
          productId: 'sapo-product-1',
          variantId: 'sapo-variant-1',
        }),
        expect.objectContaining({
          platform: 'sapo',
          sku: ' sku-6 ',
          productId: 'sapo-product-2',
          variantId: 'sapo-variant-2',
        }),
      ]),
    });
  });

  it('keeps duplicate normalized SKU representative sku stable when input order changes', () => {
    const sapoOne = snapshot('sapo', 'SKU-8-B');
    sapoOne.normalizedSku = 'SKU-8';
    const sapoTwo = snapshot('sapo', ' SKU-8-A ');
    sapoTwo.normalizedSku = 'SKU-8';
    const pancake = snapshot('pancake', 'SKU-8-PANCAKE');
    pancake.normalizedSku = 'SKU-8';

    const entries = [sapoOne, sapoTwo, pancake];
    const normal = service.buildMappings(entries);
    const reversed = service.buildMappings([...entries].reverse());

    expect(normal[0]).toMatchObject({
      sku: ' SKU-8-A ',
      normalizedSku: 'SKU-8',
      status: 'conflict',
    });
    expect(reversed[0]).toMatchObject({
      sku: ' SKU-8-A ',
      normalizedSku: 'SKU-8',
      status: 'conflict',
    });
  });

  it('marks duplicate Pancake normalized SKU as duplicate_pancake_sku conflict', () => {
    const one = snapshot('pancake', 'SKU-7');
    one.productId = 'pancake-product-1';
    one.variantId = 'pancake-variant-1';
    const two = snapshot('pancake', ' sku-7 ');
    two.normalizedSku = 'SKU-7';
    two.productId = 'pancake-product-2';
    two.variantId = 'pancake-variant-2';

    const result = service.buildMappings([
      snapshot('sapo', 'SKU-7'),
      one,
      two,
    ]);

    expect(result[0].status).toBe('conflict');
    expect(result[0].conflictDetail).toMatchObject({
      type: 'duplicate_pancake_sku',
      platform: 'pancake',
      sapoVariantCount: 1,
      pancakeVariantCount: 2,
      shopifyVariantCount: 0,
      entries: expect.arrayContaining([
        expect.objectContaining({
          platform: 'pancake',
          sku: 'SKU-7',
          productId: 'pancake-product-1',
          variantId: 'pancake-variant-1',
        }),
        expect.objectContaining({
          platform: 'pancake',
          sku: ' sku-7 ',
          productId: 'pancake-product-2',
          variantId: 'pancake-variant-2',
        }),
      ]),
    });
  });

  it('marks Sapo and Pancake multi-warehouse SKU as conflict', () => {
    const pancakeSnapshot = snapshot('pancake', 'SKU-4');
    pancakeSnapshot.warehouseCount = 2;

    const result = service.buildMappings([
      snapshot('sapo', 'SKU-4'),
      pancakeSnapshot,
    ]);

    expect(result[0]).toMatchObject({
      sku: 'SKU-4',
      status: 'conflict',
      conflictReason: 'Pancake SKU has multiple warehouses',
    });
    expect(result[0].conflictDetail).toMatchObject({
      type: 'multiple_pancake_warehouses',
      platform: 'pancake',
      sapoVariantCount: 1,
      pancakeVariantCount: 1,
      shopifyVariantCount: 0,
    });
  });

  it('marks SKU without Sapo as partial and does not make it syncable', () => {
    const result = service.buildMappings([snapshot('shopify', 'SKU-5')]);

    expect(result[0]).toMatchObject({
      sku: 'SKU-5',
      status: 'partial',
      conflictReason: 'Missing Sapo source record',
    });
  });
});
