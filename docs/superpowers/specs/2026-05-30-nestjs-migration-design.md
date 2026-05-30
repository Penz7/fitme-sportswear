# NestJS Migration Design

## Context

The current `sportswear-main` project is a Java 21 Spring Boot application for synchronizing Sapo, Pancake, and Shopify stores. The indexed codebase shows integration-heavy business logic around products, orders, customers, webhooks, external mappings, and platform-specific API clients. The new system will be built as a fresh source tree at the repository root and migrated flow by flow.

## Goals

- Improve maintainability for a small team.
- Simplify local/internal operation.
- Increase delivery speed for new integration work.
- Improve reliability and throughput of synchronization between Sapo, Pancake, and Shopify.
- Start with operational foundations before migrating business flows.

## Chosen approach

Use **NestJS + TypeScript** as a new backend source named `fitme-sportswear-backend/`.

Architecture choice: **NestJS Modular Monolith + BullMQ workers**.

Runtime components for local operation:

- `api`: HTTP API for health, config, test endpoints, and future webhooks.
- `worker`: BullMQ processors for synchronization jobs.
- `postgres`: new, fully separate PostgreSQL database.
- `redis`: queue, cache, and short-lived coordination store.

The Java application remains only as a business-reference source while flows are migrated. The new backend does not read or depend on the Java database.

## Source layout

```text
fitme-sportswear/
  sportswear-main/              # Existing Java legacy/reference project
  fitme-sportswear-backend/     # New NestJS backend
```

Initial NestJS module layout:

```text
fitme-sportswear-backend/
  src/
    app.module.ts
    main.ts
    modules/
      health/
      config/
      database/
      queue/
      sapo/
      pancake/
      shopify/
      sync/
      webhook/
```

## Module responsibilities

### `health`

Provides liveness and readiness endpoints. Readiness checks app dependencies such as PostgreSQL and Redis.

### `config`

Loads and validates environment variables at boot. Missing required variables fail fast instead of allowing the app to run in a bad state.

### `database`

Owns Prisma setup and PostgreSQL connection for the new database.

### `queue`

Owns BullMQ queue setup, producers, processors, and queue constants. Phase one includes a `test-sync` job to verify Redis, worker execution, and database logging.

### `sapo`, `pancake`, `shopify`

Platform connectors for external APIs. These modules should only know how to call their respective platforms. They should not contain cross-platform synchronization business rules.

### `sync`

Coordinates synchronization workflows. It decides which jobs to enqueue and later owns business orchestration between platform connectors.

### `webhook`

Receives platform webhooks in future phases. Phase one includes no real platform webhook handling; it may expose only internal test endpoints when required to verify routing and validation.

## Data flow

Phase-one test flow:

```text
Client/internal caller
  -> API endpoint
  -> SyncService
  -> BullMQ producer
  -> Redis queue
  -> Worker processor
  -> PostgreSQL log/status
```

Future webhook/sync flow:

```text
Sapo/Pancake/Shopify webhook
  -> WebhookController
  -> persist webhook_events
  -> check idempotency_key
  -> enqueue sync job
  -> return fast HTTP response

Worker
  -> consume Redis job
  -> call Sapo/Pancake/Shopify connector
  -> write sync_runs/job status
  -> retry/backoff transient failures
  -> mark business failures for manual/local debugging
```

## Initial database model

The first schema should support operation, observability, and future migration without modeling every business entity upfront.

Suggested tables:

```text
webhook_events
  id
  source_platform
  event_type
  external_event_id
  payload
  received_at
  processed_at
  status

idempotency_keys
  id
  key
  scope
  expires_at
  created_at

sync_runs
  id
  sync_type
  status
  started_at
  finished_at
  error_message
  metadata

external_mappings
  id
  source_platform
  source_id
  target_platform
  target_id
  entity_type
  created_at
```

Phase one only needs the parts required for health checks, test sync jobs, and operational readiness.

## Synchronization throughput strategy

- Use BullMQ queues for slow or retryable work.
- API/webhook handlers should enqueue jobs and return quickly.
- Use separate queues by workload when real flows are migrated, such as `product-sync`, `order-sync`, `webhook-processing`, and `test-sync`.
- Configure concurrency per queue.
- Keep jobs small enough to retry safely.
- Use Redis for short-lived duplicate prevention and coordination.
- Use PostgreSQL for durable job status, sync runs, audit trails, and mappings.
- Respect external platform rate limits in connector or queue configuration.

## Configuration

The new backend has its own `.env` and does not share the Java `.env`.

Initial environment groups:

```text
APP_ENV=local
APP_PORT=3000

DATABASE_URL=postgresql://...
REDIS_HOST=localhost
REDIS_PORT=6379

SAPO_BASE_URL=...
SAPO_ACCESS_TOKEN=...

PANCAKE_BASE_URL=...
PANCAKE_API_KEY=...

SHOPIFY_BASE_URL=...
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_WEBHOOK_SECRET=...
```

The app must not expose secrets through logs or public config endpoints.

## Local operation

Phase one targets local/internal operation only. Cloud deployment and production CI/CD are out of scope.

Recommended local files:

```text
Dockerfile
docker-compose.yml
.env.example
```

Local services:

```text
postgres
redis
api
worker
```

Useful scripts:

```text
npm run start:dev
npm run worker:dev
npm run test
npm run test:e2e
npm run prisma:migrate
```

## Initial API surface

```text
GET  /health
GET  /health/readiness
GET  /config/public
POST /sync/test
GET  /sync/test/:id
```

`/config/public` may return non-sensitive values such as environment, app version, and queue names. It must never return tokens, API keys, database URLs, or webhook secrets.

## Error handling

Errors are classified into three groups:

```text
TRANSIENT
  Network errors, timeouts, rate limits, and 5xx platform responses.
  Retry with exponential backoff.

BUSINESS
  Invalid data, missing mapping, or disallowed entity state.
  Do not retry indefinitely. Persist a clear failure status and error code/message.

SYSTEM
  Database, Redis, or configuration failures.
  Fail fast on boot where appropriate, or report degraded readiness.
```

Workers must not silently swallow errors. Jobs should record status, retry count, concise error message, and enough metadata for local debugging.

## Security baseline

- Do not log tokens, API keys, webhook secrets, or full sensitive payloads.
- Validate environment variables during boot.
- Prepare proper webhook secret verification before real webhook migration.
- Treat test endpoints as internal/local endpoints.
- Keep public config output strictly non-sensitive.

## Phase-one scope

Phase one builds the foundation only:

- Create `fitme-sportswear-backend/`.
- Set up NestJS app.
- Set up Prisma with a new PostgreSQL database.
- Set up Redis and BullMQ.
- Add health/config/test sync endpoints.
- Add worker processing for a test sync job.
- Add Docker Compose for local operation.
- Add basic tests for API, config, DB, and queue/worker behavior.

Phase one explicitly does not migrate product, customer, order, inventory, fulfillment, or webhook business logic.

## Suggested migration order after phase one

1. Product sync.
2. Customer sync.
3. Order sync and webhooks.
4. Fulfillment/inventory if still required by the Java business flow.

Each business flow should be migrated as a separate vertical slice with behavior parity checks against the Java implementation and available platform API samples.
