function parseStringMap(value: string | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, mapValue]) => [key, String(mapValue)]),
    );
  } catch {
    return {};
  }
}

function parseStringList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default () => ({
  app: {
    env: process.env.APP_ENV ?? 'local',
    port: Number(process.env.APP_PORT ?? 3000),
    version: process.env.APP_VERSION ?? '0.1.0',
  },
  redis: {
    host: process.env.REDIS_HOST as string,
    port: Number(process.env.REDIS_PORT),
  },
  sapo: {
    baseUrl: process.env.SAPO_BASE_URL as string,
    accountBaseUrl: process.env.SAPO_ACCOUNT_BASE_URL ?? 'https://accounts.sapo.vn',
    phoneNumber: process.env.SAPO_PHONE_NUMBER as string,
    password: process.env.SAPO_PASSWORD as string,
    clientId: process.env.SAPO_CLIENT_ID as string,
    shopDomain: process.env.SAPO_SHOP_DOMAIN as string,
    locationId: process.env.SAPO_LOCATION_ID ?? '572310',
    productRequestTimeoutMs: Number(
      process.env.SAPO_PRODUCT_REQUEST_TIMEOUT_MS ?? 30000,
    ),
    pancakeSourceId: Number(process.env.SAPO_PANCAKE_SOURCE_ID ?? 307258),
    locationIdByPancakeWarehouseId: parseStringMap(
      process.env.SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID,
    ),
    prepaymentMethodId: Number(process.env.SAPO_PREPAYMENT_METHOD_ID ?? 2575663),
    prepaymentMethodName: process.env.SAPO_PREPAYMENT_METHOD_NAME ?? 'Chuyen khoan',
  },
  pancake: {
    baseUrl: process.env.PANCAKE_BASE_URL as string,
    apiKey: process.env.PANCAKE_API_KEY as string,
    shopId: process.env.PANCAKE_SHOP_ID as string,
    webhookSecret: process.env.PANCAKE_WEBHOOK_SECRET,
    defaultWarehouseId: process.env.PANCAKE_DEFAULT_WAREHOUSE_ID,
    testOrderFilter: process.env.PANCAKE_TEST_ORDER_FILTER,
    productRequestTimeoutMs: Number(
      process.env.PANCAKE_PRODUCT_REQUEST_TIMEOUT_MS ?? 15000,
    ),
    productRetryAttempts: Number(
      process.env.PANCAKE_PRODUCT_RETRY_ATTEMPTS ?? 3,
    ),
    productRetryBackoffMs: Number(
      process.env.PANCAKE_PRODUCT_RETRY_BACKOFF_MS ?? 1000,
    ),
  },
  shopify: {
    baseUrl: process.env.SHOPIFY_BASE_URL as string,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN as string,
    apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-04',
    locationId: process.env.SHOPIFY_LOCATION_ID,
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  shipping: {
    sender: {
      provinceId: Number(process.env.SHIPPING_SENDER_PROVINCE_ID ?? 2),
      districtId: Number(process.env.SHIPPING_SENDER_DISTRICT_ID ?? 55),
    },
    package: {
      weight: Number(process.env.SHIPPING_PACKAGE_WEIGHT ?? 300),
      height: Number(process.env.SHIPPING_PACKAGE_HEIGHT ?? 10),
      width: Number(process.env.SHIPPING_PACKAGE_WIDTH ?? 10),
      length: Number(process.env.SHIPPING_PACKAGE_LENGTH ?? 10),
    },
    viettelPost: {
      service: process.env.VIETTELPOST_SERVICE ?? 'VSL7',
      accountId: process.env.VIETTELPOST_ACCOUNT_ID ?? '604003_1',
      providerId: Number(process.env.VIETTELPOST_PROVIDER_ID ?? 508146),
      inventoryId: Number(process.env.VIETTELPOST_INVENTORY_ID ?? 22207987),
      trackingCompany: process.env.VIETTELPOST_TRACKING_COMPANY ?? 'Viettel',
    },
  },
  webhook: {
    ingestionEnabled: process.env.WEBHOOK_INGESTION_ENABLED !== 'false',
    pancake: {
      enabled: process.env.PANCAKE_WEBHOOK_ENABLED !== 'false',
    },
    shopify: {
      enabled: process.env.SHOPIFY_WEBHOOK_ENABLED !== 'false',
    },
  },
  sync: {
    apiToken: process.env.SYNC_API_TOKEN,
    startup: {
      productSyncEnabled: process.env.SYNC_STARTUP_PRODUCT_SYNC_ENABLED === 'true',
    },
    products: {
      createMissingPancake:
        process.env.SYNC_CREATE_MISSING_PANCAKE_PRODUCTS !== 'false',
      skuBlocklist: parseStringList(process.env.SYNC_PRODUCT_SYNC_SKU_BLOCKLIST),
      skuBlocklistFile: process.env.SYNC_PRODUCT_SYNC_SKU_BLOCKLIST_FILE,
      createMissingShopify:
        process.env.SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS === 'true',
    },
    sapoToPancakeInventory: {
      circuitBreakerThreshold: Number(
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_CIRCUIT_BREAKER ?? 500,
      ),
      batchSize: Number(
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_BATCH_SIZE ?? 100,
      ),
      delayMs: Number(
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_DELAY_MS ?? 50,
      ),
      retryAttempts: Number(
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_RETRY_ATTEMPTS ?? 3,
      ),
      maxUpdatesPerRun: Number(
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_MAX_UPDATES_PER_RUN ?? 200,
      ),
      hotWindowMinutes: Number(
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_HOT_WINDOW_MINUTES ?? 30,
      ),
    },
    orders: {
      updatePancakeInventoryByOrder:
        process.env.SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER === 'true',
    },
    address: {
      enabled: process.env.SYNC_ADDRESS_ENABLED !== 'false',
      minProvinces: Number(process.env.SYNC_ADDRESS_MIN_PROVINCES ?? 1),
      minDistricts: Number(process.env.SYNC_ADDRESS_MIN_DISTRICTS ?? 1),
      minWards: Number(process.env.SYNC_ADDRESS_MIN_WARDS ?? 1),
      maxDistance: Number(process.env.SYNC_ADDRESS_MAX_DISTANCE ?? 0.75),
    },
    scheduler: {
      enabled: process.env.SYNC_SCHEDULER_ENABLED === 'true',
      productCron: process.env.SYNC_PRODUCT_CRON,
      sapoToPancakeInventoryCron:
        process.env.SYNC_SAPO_TO_PANCAKE_INVENTORY_CRON,
      addressCron: process.env.SYNC_ADDRESS_MAPPING_CRON,
      sapoOrderCron: process.env.SYNC_SAPO_TO_PANCAKE_ORDER_CRON,
      sapoOrderStatus: process.env.SYNC_SAPO_TO_PANCAKE_ORDER_STATUS,
      sapoOrderLimit: process.env.SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT
        ? Number(process.env.SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT)
        : undefined,
      sapoTopOrderCron: process.env.SYNC_SAPO_TOP_ORDER_CRON,
      sapoTopOrderLimit: process.env.SYNC_SAPO_TOP_ORDER_LIMIT
        ? Number(process.env.SYNC_SAPO_TOP_ORDER_LIMIT)
        : undefined,
      sapoLogCron: process.env.SYNC_SAPO_LOG_CRON,
    },
  },
});
