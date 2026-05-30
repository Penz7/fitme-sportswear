import { ProductMatchingService } from './product-matching.service';
import { PlatformProductSnapshot } from './types/platform-product-snapshot';

function snapshot(
  platform: PlatformProductSnapshot['platform'],
  sku: string,
): PlatformProductSnapshot {
  return {
    platform,
    sku,
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
      conflictReason: 'Duplicate SKU in pancake',
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
