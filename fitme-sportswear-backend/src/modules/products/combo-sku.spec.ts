import { getComboSkuComponents, isComboSku } from './combo-sku';

describe('getComboSkuComponents', () => {
  it('splits a two-component Fitme combo SKU', () => {
    expect(getComboSkuComponents('FM-AVBNU-XR-S-FM-QNTG01-DE-S')).toEqual([
      { sku: 'FM-AVBNU-XR-S', quantity: 1 },
      { sku: 'FM-QNTG01-DE-S', quantity: 1 },
    ]);
  });

  it('normalizes before splitting', () => {
    expect(getComboSkuComponents(' fm-avbnu-xr-s-fm-qntg01-de-s ')).toEqual([
      { sku: 'FM-AVBNU-XR-S', quantity: 1 },
      { sku: 'FM-QNTG01-DE-S', quantity: 1 },
    ]);
  });

  it.each(['FM-ATSO01-DO-L', 'VV-DXSP01-TR-M', 'FM-A-FM-B-FM-C', ''])(
    'returns null for malformed or non-combo SKU %s',
    (sku) => {
      expect(getComboSkuComponents(sku)).toBeNull();
    },
  );
});

describe('isComboSku', () => {
  it.each([
    'FM-ATSO01-DO-L-FM-VSFM01-TR-L',
    'FM-ATSO01-HP-L-FM-QDZT01-DE-XL',
  ])('detects Fitme combo SKU %s', (sku) => {
    expect(isComboSku(sku)).toBe(true);
  });

  it('matches parseable two-component combo SKUs', () => {
    expect(isComboSku('FM-AVBNU-XR-S-FM-QNTG01-DE-S')).toBe(true);
  });

  it.each([
    'FM-ATSO01-DO-L',
    'FM-ATTL01-HP-XL',
    'VV-DXSP01-TR-M',
    '',
  ])('does not classify ordinary SKU %s as combo', (sku) => {
    expect(isComboSku(sku)).toBe(false);
  });
});
