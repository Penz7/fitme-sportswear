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
  },
  pancake: {
    baseUrl: process.env.PANCAKE_BASE_URL as string,
  },
  shopify: {
    baseUrl: process.env.SHOPIFY_BASE_URL as string,
  },
});
