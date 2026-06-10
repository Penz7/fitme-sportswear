import { normalizeSku } from './sku-normalizer';

export interface ComboSkuComponent {
  sku: string;
  quantity: number;
}

export const getComboSkuComponents = (
  sku: string,
): ComboSkuComponent[] | null => {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku.startsWith('FM-')) {
    return null;
  }

  const marker = '-FM-';
  const markerIndex = normalizedSku.indexOf(marker, 3);
  if (
    markerIndex < 0 ||
    normalizedSku.indexOf(marker, markerIndex + marker.length) >= 0
  ) {
    return null;
  }

  const firstSku = normalizedSku.slice(0, markerIndex);
  const secondSku = normalizedSku.slice(markerIndex + 1);
  if (!firstSku || !secondSku.startsWith('FM-')) {
    return null;
  }

  return [
    { sku: firstSku, quantity: 1 },
    { sku: secondSku, quantity: 1 },
  ];
};

export const isComboSku = (sku: string): boolean =>
  getComboSkuComponents(sku) !== null;
