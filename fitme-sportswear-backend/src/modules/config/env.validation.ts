import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  APP_ENV: Joi.string().valid('local', 'test', 'development', 'production').default('local'),
  APP_PORT: Joi.number().port().default(3000),
  APP_VERSION: Joi.string().default('0.1.0'),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),

  SAPO_BASE_URL: Joi.string().uri().required(),
  SAPO_ACCOUNT_BASE_URL: Joi.string().uri().default('https://accounts.sapo.vn'),
  SAPO_PHONE_NUMBER: Joi.string().required(),
  SAPO_PASSWORD: Joi.string().required(),
  SAPO_CLIENT_ID: Joi.string().required(),
  SAPO_SHOP_DOMAIN: Joi.string().required(),
  SAPO_LOCATION_ID: Joi.string().default('572310'),
  SAPO_PRODUCT_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),

  PANCAKE_BASE_URL: Joi.string().uri().required(),
  PANCAKE_API_KEY: Joi.string().required(),
  PANCAKE_SHOP_ID: Joi.string().required(),
  PANCAKE_WEBHOOK_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  PANCAKE_DEFAULT_WAREHOUSE_ID: Joi.string().allow('').optional(),
  PANCAKE_PRODUCT_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1000).default(15000),
  PANCAKE_PRODUCT_RETRY_ATTEMPTS: Joi.number().integer().min(1).default(3),
  PANCAKE_PRODUCT_RETRY_BACKOFF_MS: Joi.number().integer().min(0).default(1000),

  SHOPIFY_BASE_URL: Joi.string().uri().required(),
  SHOPIFY_ACCESS_TOKEN: Joi.string().required(),
  SHOPIFY_API_VERSION: Joi.string().default('2024-04'),
  SHOPIFY_LOCATION_ID: Joi.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  SHOPIFY_WEBHOOK_PUBLIC_BASE_URL: Joi.string().uri().allow('').optional(),
  SHOPIFY_WEBHOOK_AUTO_REGISTER_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  SHOPIFY_PRODUCT_FETCH_PAGE_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .default(750),
  SHOPIFY_PRODUCT_FETCH_MAX_RETRIES: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(5),
  SHOPIFY_PRODUCT_FETCH_RETRY_BASE_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .default(2000),
  SHOPIFY_TEST_ORDER_FILTER: Joi.string().allow('').optional(),
  WEBHOOK_INGESTION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  PANCAKE_WEBHOOK_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  SHOPIFY_WEBHOOK_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  QUEUE_PROCESSORS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  SYNC_API_TOKEN: Joi.when('APP_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  TELEGRAM_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_CHAT_ID: Joi.string().allow('').optional(),

  SHIPPING_SENDER_PROVINCE_ID: Joi.number().integer().positive().default(2),
  SHIPPING_SENDER_DISTRICT_ID: Joi.number().integer().positive().default(55),
  SHIPPING_SENDER_WARD_ID: Joi.number().integer().min(0).default(0),
  SHIPPING_PACKAGE_WEIGHT: Joi.number().integer().positive().default(300),
  SHIPPING_PACKAGE_HEIGHT: Joi.number().integer().positive().default(10),
  SHIPPING_PACKAGE_WIDTH: Joi.number().integer().positive().default(10),
  SHIPPING_PACKAGE_LENGTH: Joi.number().integer().positive().default(10),
  VIETTELPOST_SERVICE: Joi.string().default('VSL7'),
  VIETTELPOST_ACCOUNT_ID: Joi.string().default('604003_1'),
  VIETTELPOST_PROVIDER_ID: Joi.number().integer().positive().default(508146),
  VIETTELPOST_INVENTORY_ID: Joi.number().integer().positive().default(22207987),
  VIETTELPOST_TRACKING_COMPANY: Joi.string().default('Viettel'),

  SYNC_SCHEDULER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  SYNC_STARTUP_PRODUCT_SYNC_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_PRODUCT_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_CIRCUIT_BREAKER: Joi.number()
    .integer()
    .min(1)
    .default(500),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .default(100),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .default(50),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_RETRY_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_MAX_UPDATES_PER_RUN: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(200),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_HOT_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(30),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_CREATE_RECENT_MISSING_PANCAKE_PRODUCTS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_CREATE_RECENT_MISSING_PANCAKE_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(60),
  SYNC_SAPO_TO_PANCAKE_INVENTORY_CREATE_RECENT_MISSING_PANCAKE_MAX_PER_RUN: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),
  SYNC_ADDRESS_MAPPING_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_ORDER_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_ORDER_STATUS: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT: Joi.number().integer().min(1).max(250).optional(),
  SYNC_SAPO_TOP_ORDER_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TOP_ORDER_SHOPIFY_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TOP_ORDER_LIMIT: Joi.number().integer().min(1).max(250).optional(),
  SYNC_SHOPIFY_ORDER_RECONCILE_CRON: Joi.string().allow('').optional(),
  SYNC_SHOPIFY_ORDER_RECONCILE_LIMIT: Joi.number().integer().min(1).max(250).optional(),
  SYNC_SAPO_LOG_CRON: Joi.string().allow('').optional(),
  SYNC_CREATE_MISSING_PANCAKE_PRODUCTS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  SYNC_PRODUCT_SYNC_SKU_BLOCKLIST: Joi.string().allow('').optional(),
  SYNC_PRODUCT_SYNC_SKU_BLOCKLIST_FILE: Joi.string().allow('').optional(),
  SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(60),
  SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_MAX_PER_RUN: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .default(20),
  SYNC_CREATE_MISSING_SHOPIFY_SKU_ALLOWLIST: Joi.string()
    .allow('')
    .optional(),
  SYNC_SHOPIFY_INVENTORY_HOT_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .max(1440)
    .default(30),
  SYNC_SHOPIFY_PRODUCT_SYNC_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_CREATE_PANCAKE_ORDERS_FROM_SAPO: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_ADDRESS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  SYNC_ADDRESS_MIN_PROVINCES: Joi.number().integer().min(0).default(1),
  SYNC_ADDRESS_MIN_DISTRICTS: Joi.number().integer().min(0).default(1),
  SYNC_ADDRESS_MIN_WARDS: Joi.number().integer().min(0).default(1),
  SYNC_ADDRESS_MAX_DISTANCE: Joi.number().min(0).max(1).default(0.75),
});
