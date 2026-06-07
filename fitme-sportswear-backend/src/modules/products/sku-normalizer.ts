export const normalizeSku = (sku: string | null | undefined): string =>
  String(sku ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
