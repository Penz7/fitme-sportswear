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

  PANCAKE_BASE_URL: Joi.string().uri().required(),
  PANCAKE_API_KEY: Joi.string().required(),
  PANCAKE_SHOP_ID: Joi.string().required(),

  SHOPIFY_BASE_URL: Joi.string().uri().required(),
  SHOPIFY_ACCESS_TOKEN: Joi.string().required(),
  SHOPIFY_API_VERSION: Joi.string().default('2024-04'),
  SHOPIFY_LOCATION_ID: Joi.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: Joi.string().optional(),
  TELEGRAM_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_CHAT_ID: Joi.string().allow('').optional(),

  SHIPPING_SENDER_PROVINCE_ID: Joi.number().integer().positive().default(2),
  SHIPPING_SENDER_DISTRICT_ID: Joi.number().integer().positive().default(55),
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
  SYNC_ADDRESS_MAPPING_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_ORDER_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_ORDER_STATUS: Joi.string().allow('').optional(),
  SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT: Joi.number().integer().min(1).max(250).optional(),
  SYNC_SAPO_TOP_ORDER_CRON: Joi.string().allow('').optional(),
  SYNC_SAPO_TOP_ORDER_LIMIT: Joi.number().integer().min(1).max(250).optional(),
  SYNC_SAPO_LOG_CRON: Joi.string().allow('').optional(),
  SYNC_CREATE_MISSING_PANCAKE_PRODUCTS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
  SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
});
