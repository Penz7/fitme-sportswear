import { normalizeSku } from './sku-normalizer';

describe('normalizeSku', () => {
  it('trims and uppercases SKU for matching', () => {
    expect(normalizeSku(' abc-123 ')).toBe('ABC-123');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeSku('AB  12\tCD')).toBe('AB 12 CD');
  });

  it('returns empty string for whitespace-only SKU', () => {
    expect(normalizeSku('   ')).toBe('');
  });
});
