import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  APP_ENV: Joi.string().valid('local', 'test', 'development', 'production').default('local'),
  APP_PORT: Joi.number().port().default(3000),
  APP_VERSION: Joi.string().default('0.1.0'),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().required(),
  SAPO_BASE_URL: Joi.string().uri().required(),
  SAPO_ACCESS_TOKEN: Joi.string().required(),
  PANCAKE_BASE_URL: Joi.string().uri().required(),
  PANCAKE_API_KEY: Joi.string().required(),
  SHOPIFY_BASE_URL: Joi.string().uri().required(),
  SHOPIFY_ACCESS_TOKEN: Joi.string().required(),
  SHOPIFY_WEBHOOK_SECRET: Joi.string().required(),
});
