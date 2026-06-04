import { envValidationSchema } from './env.validation';

describe('envValidationSchema Phase 4 configuration', () => {
  const validEnvironment = {
    DATABASE_URL: 'postgresql://fitme:fitme@localhost:5432/fitme',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    SAPO_BASE_URL: 'https://example.mysapogo.com',
    SAPO_PHONE_NUMBER: '0900000000',
    SAPO_PASSWORD: 'secret',
    SAPO_CLIENT_ID: 'client-id',
    SAPO_SHOP_DOMAIN: 'example.mysapogo.com',
    SAPO_LOCATION_ID: '572310',
    SAPO_PANCAKE_SOURCE_ID: '5632931',
    SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID:
      '{"warehouse-1":"572310"}',
    SAPO_PREPAYMENT_METHOD_ID: '2575663',
    SAPO_PREPAYMENT_METHOD_NAME: 'Chuyen khoan',
    PANCAKE_BASE_URL: 'https://pos.pages.fm/api/v1',
    PANCAKE_API_KEY: 'key',
    PANCAKE_SHOP_ID: '1290216695',
    PANCAKE_DEFAULT_WAREHOUSE_ID: 'warehouse-1',
    SHOPIFY_BASE_URL: 'https://example.myshopify.com',
    SHOPIFY_ACCESS_TOKEN: 'token',
  };

  it.each([
    'SAPO_PANCAKE_SOURCE_ID',
    'SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID',
    'SAPO_PREPAYMENT_METHOD_ID',
    'SAPO_PREPAYMENT_METHOD_NAME',
    'PANCAKE_DEFAULT_WAREHOUSE_ID',
  ])('requires %s', (key) => {
    const environment = { ...validEnvironment, [key]: undefined };

    expect(envValidationSchema.validate(environment).error).toBeDefined();
  });

  it('rejects invalid warehouse-location JSON', () => {
    const environment = {
      ...validEnvironment,
      SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID: 'not-json',
    };

    expect(envValidationSchema.validate(environment).error?.message).toContain(
      'SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID',
    );
  });

  it('requires the default warehouse to map to the configured Sapo location', () => {
    const environment = {
      ...validEnvironment,
      SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID:
        '{"another-warehouse":"572310"}',
    };

    expect(envValidationSchema.validate(environment).error?.message).toContain(
      'PANCAKE_DEFAULT_WAREHOUSE_ID',
    );
  });

  it('accepts a complete Phase 4 configuration', () => {
    expect(envValidationSchema.validate(validEnvironment).error).toBeUndefined();
  });
});
