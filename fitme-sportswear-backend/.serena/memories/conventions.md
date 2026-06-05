# Conventions

Backend structure:
- Nest modules/services/controllers live under `src/modules/<domain>`.
- Tests are colocated as `*.spec.ts` under `src`.
- Config values are declared in `configuration.ts`, validated in `env.validation.ts`, and consumed through `ConfigService` nested keys.
- Feature flags use explicit defaults and boolean parsing that accepts booleans plus `'true'`/`'false'` strings.

Integration rules:
- External writes should be narrow, ID/code-scoped, and idempotent where possible; do not globally suppress integration errors.
- Shopify webhooks verify raw-body HMAC with `ShopifyHmacService`; Pancake webhooks verify shared secret.
- Webhook ingestion persists `WebhookEvent`, writes `IdempotencyKey`, then enqueues BullMQ work.
- Pancake `order_updated` idempotency includes raw payload hash; create/static events keep stable platform/event/external ID keys.
- Shopify fulfillment should use Fulfillment Orders API, not legacy order fulfillment endpoint.
- Sapo 422 tolerance must be operation-specific and only for already-applied/idempotent states.
- Scheduled syncs use Redis lock `lock:sync:<syncType>` to prevent overlapping same sync type.
- Address sync uses safety thresholds and transactional replacement.