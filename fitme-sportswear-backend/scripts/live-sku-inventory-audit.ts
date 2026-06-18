import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { PancakeClient } from '../src/modules/pancake/pancake.client';
import {
  mapPancakeProductSnapshot,
  mapSapoProductSnapshot,
  mapShopifyProductSnapshots,
} from '../src/modules/products/product-snapshot.mapper';
import { PlatformProductSnapshot } from '../src/modules/products/types/platform-product-snapshot';
import { SapoClient } from '../src/modules/sapo/sapo.client';
import { SapoSessionService } from '../src/modules/sapo/sapo-session.service';
import { ShopifyClient } from '../src/modules/shopify/shopify.client';

type Platform = 'pancake' | 'shopify';

interface AuditRow {
  platform: Platform;
  issueType: 'missing_on_platform' | 'extra_on_platform' | 'inventory_diff';
  sku: string;
  sapoAvailable: number | null;
  platformAvailable: number | null;
}

class EnvConfigService {
  constructor(private readonly values: Record<string, string | undefined>) {}

  get<T = string>(key: string): T | undefined {
    return this.values[key] as T | undefined;
  }

  getOrThrow<T = string>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing config: ${key}`);
    }
    return value;
  }
}

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function buildConfig(env: Record<string, string>): ConfigService {
  const values: Record<string, string | undefined> = {
    'sapo.baseUrl': env.SAPO_BASE_URL,
    'sapo.accountBaseUrl': env.SAPO_ACCOUNT_BASE_URL ?? 'https://accounts.sapo.vn',
    'sapo.phoneNumber': env.SAPO_PHONE_NUMBER,
    'sapo.password': env.SAPO_PASSWORD,
    'sapo.clientId': env.SAPO_CLIENT_ID,
    'sapo.shopDomain': env.SAPO_SHOP_DOMAIN,
    'sapo.productRequestTimeoutMs': env.SAPO_PRODUCT_REQUEST_TIMEOUT_MS ?? '30000',
    'pancake.baseUrl': env.PANCAKE_BASE_URL,
    'pancake.apiKey': env.PANCAKE_API_KEY,
    'pancake.shopId': env.PANCAKE_SHOP_ID,
    'pancake.productRequestTimeoutMs': env.PANCAKE_PRODUCT_REQUEST_TIMEOUT_MS ?? '15000',
    'pancake.productRetryAttempts': env.PANCAKE_PRODUCT_RETRY_ATTEMPTS ?? '3',
    'pancake.productRetryBackoffMs': env.PANCAKE_PRODUCT_RETRY_BACKOFF_MS ?? '1000',
    'shopify.baseUrl': env.SHOPIFY_BASE_URL,
    'shopify.accessToken': env.SHOPIFY_ACCESS_TOKEN,
    'shopify.apiVersion': env.SHOPIFY_API_VERSION ?? '2024-04',
    'shopify.locationId': env.SHOPIFY_LOCATION_ID,
    'shopify.productFetchPageDelayMs': env.SHOPIFY_PRODUCT_FETCH_PAGE_DELAY_MS ?? '750',
    'shopify.productFetchMaxRetries': env.SHOPIFY_PRODUCT_FETCH_MAX_RETRIES ?? '5',
    'shopify.productFetchRetryBaseDelayMs':
      env.SHOPIFY_PRODUCT_FETCH_RETRY_BASE_DELAY_MS ?? '2000',
    'shopify.requestTimeoutMs': env.SHOPIFY_REQUEST_TIMEOUT_MS ?? '30000',
    'shopify.requestMaxRetries': env.SHOPIFY_REQUEST_MAX_RETRIES ?? '3',
    'shopify.requestRetryBaseDelayMs': env.SHOPIFY_REQUEST_RETRY_BASE_DELAY_MS ?? '1000',
  };

  return new EnvConfigService(values) as unknown as ConfigService;
}

function keySku(sku: string): string {
  return sku.trim().toUpperCase();
}

function isShopifyComboSku(sku: string): boolean {
  return keySku(sku).includes('-FM-');
}

function dedupeSnapshots(snapshots: PlatformProductSnapshot[]) {
  const bySku = new Map<string, PlatformProductSnapshot[]>();
  for (const snapshot of snapshots) {
    const sku = keySku(snapshot.sku);
    const items = bySku.get(sku) ?? [];
    items.push(snapshot);
    bySku.set(sku, items);
  }

  const unique = new Map<string, PlatformProductSnapshot>();
  const duplicateSkus: string[] = [];
  for (const [sku, items] of bySku.entries()) {
    if (items.length > 1) {
      duplicateSkus.push(sku);
      continue;
    }
    unique.set(sku, items[0]);
  }

  return { unique, duplicateSkus: duplicateSkus.sort() };
}

function comparePlatform(
  platform: Platform,
  sapo: Map<string, PlatformProductSnapshot>,
  platformProducts: Map<string, PlatformProductSnapshot>,
) {
  const rows: AuditRow[] = [];
  for (const [sku, sapoSnapshot] of sapo.entries()) {
    const platformSnapshot = platformProducts.get(sku);
    if (!platformSnapshot) {
      rows.push({
        platform,
        issueType: 'missing_on_platform',
        sku,
        sapoAvailable: sapoSnapshot.available ?? 0,
        platformAvailable: null,
      });
      continue;
    }

    const sapoAvailable = sapoSnapshot.available ?? 0;
    const platformAvailable = platformSnapshot.available ?? 0;
    if (sapoAvailable !== platformAvailable) {
      rows.push({
        platform,
        issueType: 'inventory_diff',
        sku,
        sapoAvailable,
        platformAvailable,
      });
    }
  }

  for (const [sku, platformSnapshot] of platformProducts.entries()) {
    if (!sapo.has(sku)) {
      rows.push({
        platform,
        issueType: 'extra_on_platform',
        sku,
        sapoAvailable: null,
        platformAvailable: platformSnapshot.available ?? 0,
      });
    }
  }

  return rows.sort((a, b) =>
    `${a.platform}:${a.issueType}:${a.sku}`.localeCompare(
      `${b.platform}:${b.issueType}:${b.sku}`,
    ),
  );
}

function csvEscape(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(path: string, rows: AuditRow[]) {
  mkdirSync(dirname(path), { recursive: true });
  const header = [
    'platform',
    'issue_type',
    'sku',
    'sapo_available',
    'platform_available',
  ];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.platform,
        row.issueType,
        row.sku,
        row.sapoAvailable,
        row.platformAvailable,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];
  writeFileSync(path, `${lines.join('\n')}\n`);
}

function countRows(rows: AuditRow[], platform: Platform, issueType: AuditRow['issueType']) {
  return rows.filter((row) => row.platform === platform && row.issueType === issueType).length;
}

async function main() {
  const root = resolve(__dirname, '..');
  const env = loadEnv(resolve(root, '.env'));
  const config = buildConfig(env);

  const sapoClient = new SapoClient(
    config,
    new SapoSessionService(config),
  );
  const pancakeClient = new PancakeClient(config);
  const shopifyClient = new ShopifyClient(config);

  console.log('Fetching Sapo products from live API...');
  const sapoProducts = await sapoClient.fetchProducts();
  const sapoSnapshots = sapoProducts.flatMap((product) =>
    mapSapoProductSnapshot(product),
  );
  console.log(`Fetched Sapo products=${sapoProducts.length}, snapshots=${sapoSnapshots.length}`);

  console.log('Fetching Pancake products from live API...');
  const pancakeProducts = await pancakeClient.fetchProducts();
  const pancakeSnapshots = pancakeProducts
    .map((product) => mapPancakeProductSnapshot(product))
    .filter((snapshot): snapshot is PlatformProductSnapshot => Boolean(snapshot));
  console.log(
    `Fetched Pancake variations=${pancakeProducts.length}, snapshots=${pancakeSnapshots.length}`,
  );

  console.log('Fetching Shopify products from live API...');
  const shopifyProducts = await shopifyClient.fetchProducts();
  const shopifySnapshots = shopifyProducts
    .flatMap((product) => mapShopifyProductSnapshots(product))
    .filter((snapshot) => !isShopifyComboSku(snapshot.sku));
  console.log(
    `Fetched Shopify products=${shopifyProducts.length}, regular snapshots=${shopifySnapshots.length}`,
  );

  const sapoAll = dedupeSnapshots(sapoSnapshots);
  const pancake = dedupeSnapshots(pancakeSnapshots);
  const sapoRegular = dedupeSnapshots(
    sapoSnapshots.filter((snapshot) => !isShopifyComboSku(snapshot.sku)),
  );
  const shopify = dedupeSnapshots(shopifySnapshots);

  const rows = [
    ...comparePlatform('pancake', sapoAll.unique, pancake.unique),
    ...comparePlatform('shopify', sapoRegular.unique, shopify.unique),
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = resolve(root, 'reports', `live-sku-inventory-audit-${timestamp}.csv`);
  writeCsv(csvPath, rows);

  const summary = {
    fetchedAt: new Date().toISOString(),
    csvPath,
    sapo: {
      products: sapoProducts.length,
      comparableSkusAll: sapoAll.unique.size,
      comparableSkusRegular: sapoRegular.unique.size,
      duplicateSkus: sapoAll.duplicateSkus.length,
      duplicateSkusSample: sapoAll.duplicateSkus.slice(0, 20),
    },
    pancake: {
      variations: pancakeProducts.length,
      comparableSkus: pancake.unique.size,
      duplicateSkus: pancake.duplicateSkus.length,
      duplicateSkusSample: pancake.duplicateSkus.slice(0, 20),
      missingFromSapo: countRows(rows, 'pancake', 'missing_on_platform'),
      extraNotInSapo: countRows(rows, 'pancake', 'extra_on_platform'),
      inventoryDiff: countRows(rows, 'pancake', 'inventory_diff'),
    },
    shopify: {
      products: shopifyProducts.length,
      comparableRegularSkus: shopify.unique.size,
      duplicateRegularSkus: shopify.duplicateSkus.length,
      duplicateRegularSkusSample: shopify.duplicateSkus.slice(0, 20),
      missingFromSapoRegular: countRows(rows, 'shopify', 'missing_on_platform'),
      extraNotInSapoRegular: countRows(rows, 'shopify', 'extra_on_platform'),
      inventoryDiffRegular: countRows(rows, 'shopify', 'inventory_diff'),
    },
  };

  const summaryPath = csvPath.replace(/\.csv$/, '.summary.json');
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
