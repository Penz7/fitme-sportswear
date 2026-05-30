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
  },
  pancake: {
    baseUrl: process.env.PANCAKE_BASE_URL as string,
    apiKey: process.env.PANCAKE_API_KEY as string,
    shopId: process.env.PANCAKE_SHOP_ID as string,
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
  sync: {
    startup: {
      productSyncEnabled: process.env.SYNC_STARTUP_PRODUCT_SYNC_ENABLED === 'true',
    },
    products: {
      createMissingPancake:
        process.env.SYNC_CREATE_MISSING_PANCAKE_PRODUCTS !== 'false',
      createMissingShopify:
        process.env.SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS === 'true',
    },
    orders: {
      updatePancakeInventoryByOrder:
        process.env.SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER === 'true',
    },
    scheduler: {
      enabled: process.env.SYNC_SCHEDULER_ENABLED === 'true',
      productCron: process.env.SYNC_PRODUCT_CRON,
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
