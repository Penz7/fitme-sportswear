export const normalizeSku = (sku: string | null | undefined): string =>
  String(sku ?? '')
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase();
