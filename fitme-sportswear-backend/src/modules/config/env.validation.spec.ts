import { envValidationSchema } from './env.validation';

const baseEnv = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgresql://fitme:fitme@localhost:5433/fitme_sportswear_backend?schema=public',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6380,
  SAPO_BASE_URL: 'https://example-sapo.local',
  SAPO_PHONE_NUMBER: 'phone',
  SAPO_PASSWORD: 'password',
  SAPO_CLIENT_ID: 'client',
  SAPO_SHOP_DOMAIN: 'example-sapo.local',
  PANCAKE_BASE_URL: 'https://example-pancake.local',
  PANCAKE_API_KEY: 'pancake-key',
  PANCAKE_SHOP_ID: 'shop',
  SHOPIFY_BASE_URL: 'https://example-shopify.local',
  SHOPIFY_ACCESS_TOKEN: 'shopify-token',
};

describe('envValidationSchema', () => {
  it('allows local development without production-only secrets', () => {
    const result = envValidationSchema.validate(baseEnv, { abortEarly: false });

    expect(result.error).toBeUndefined();
    expect(result.value.WEBHOOK_INGESTION_ENABLED).toBe(true);
    expect(result.value.PANCAKE_WEBHOOK_ENABLED).toBe(true);
    expect(result.value.SHOPIFY_WEBHOOK_ENABLED).toBe(true);
  });

  it('requires webhook and sync secrets in production', () => {
    const result = envValidationSchema.validate(
      { ...baseEnv, APP_ENV: 'production' },
      { abortEarly: false },
    );

    expect(result.error?.details.map((detail) => detail.path.join('.'))).toEqual(
      expect.arrayContaining([
        'PANCAKE_WEBHOOK_SECRET',
        'SHOPIFY_WEBHOOK_SECRET',
        'SYNC_API_TOKEN',
      ]),
    );
  });

  it('accepts production when required secrets are configured', () => {
    const result = envValidationSchema.validate(
      {
        ...baseEnv,
        APP_ENV: 'production',
        PANCAKE_WEBHOOK_SECRET: 'pancake-secret',
        SHOPIFY_WEBHOOK_SECRET: 'shopify-secret',
        SYNC_API_TOKEN: 'sync-token',
      },
      { abortEarly: false },
    );

    expect(result.error).toBeUndefined();
  });
});
