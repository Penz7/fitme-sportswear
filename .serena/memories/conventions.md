# Conventions

Backend code style:
- Nest modules/services/controllers per domain under `src/modules/<domain>`.
- Tests colocated as `*.spec.ts` under `src` and run by Jest rootDir `src`.
- Config values are loaded from `configuration.ts`, validated in `env.validation.ts`, and read via `ConfigService` with nested keys.
- Feature flags use boolean parsing patterns that accept booleans or `'true'`/`'false'` strings; defaults should be explicit.
- External writes should be guarded by exact IDs/codes and narrow idempotency/tolerant-error handling; do not globally suppress integration errors.
- Security controls should fail closed in production: required webhook secrets/API tokens via Joi validation.

Integration conventions:
- Shopify webhooks verify raw-body HMAC with `ShopifyHmacService`; Pancake webhooks verify shared secret.
- Webhook ingestion persists `WebhookEvent`, writes `IdempotencyKey`, and enqueues BullMQ job.
- Pancake `order_updated` idempotency includes raw payload hash; create/static events keep stable platform/event/external ID key.
- Product inventory sync is the safe stock authority; direct Sapo-order quantity stock writes are intentionally skipped.
- Shopify fulfillment should use Fulfillment Orders API, not legacy order fulfillment endpoint.
- Sapo 422 tolerance must be operation-specific and only for already-applied/idempotent business states.