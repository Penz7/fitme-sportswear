# Core

Backend project root: `fitme-sportswear-backend/`.

Purpose: NestJS backend syncing FitMe Sportswear operational data between Sapo, Pancake, and Shopify.

Runtime shape:
- API process: `src/main.ts`; HTTP health/config/sync/webhook endpoints.
- Worker process: `src/worker.ts`; BullMQ jobs via Redis.
- Durable state: PostgreSQL through Prisma schema/migrations in `prisma/`.

Module map under `src/modules`:
- `config`: runtime config + Joi env validation.
- `database`: Prisma service/module.
- `queue`: BullMQ queue constants, producers, processors.
- `health`: liveness/readiness.
- `webhook`: Pancake/Shopify webhook endpoints, HMAC/shared-secret verification, ingestion/idempotency.
- `sync`: manual sync controller, scheduler/startup sync, token guard, Redis run lock.
- `products`: product snapshots, SKU matching, inventory sync, Shopify cleanup, orchestrator.
- `orders`: order webhook planning/execution, status mapping, Sapo logs/top-order sync, Sapo-to-Pancake order sync.
- `address`: address mapping sync/resolution between Sapo and Pancake.
- `sapo`, `pancake`, `shopify`: integration clients/session logic.
- `notifications`: Telegram notifier.

Project-wide invariants:
- Parent repo `sportswear-main/` is legacy Java reference only; do not edit for backend tasks unless explicitly asked.
- Product inventory sync is authoritative for stock; do not derive Pancake stock directly from order line quantity.
- `/sync/*` requires sync API token.
- Pancake webhook requires `x-pancake-webhook-secret`; Shopify webhook requires raw-body HMAC verification.

Read `mem:tech_stack` for versions/tools, `mem:conventions` for implementation rules, `mem:suggested_commands` for commands, and `mem:task_completion` before closing implementation work.