# Backend Core

Active code: `fitme-sportswear-backend/`.

Module map:
- `config`: Joi env validation + nested config object.
- `database`: Prisma service.
- `queue`: BullMQ queue constants/module/producers/processors.
- `health`: liveness/readiness.
- `webhook`: Pancake/Shopify endpoints, Shopify HMAC, Pancake shared secret, ingestion/idempotency.
- `sync`: manual sync controller, scheduler, scheduled processor, startup sync, sync API guard, Redis sync lock.
- `products`: Sapo/Pancake/Shopify product snapshots, SKU matching, inventory sync, Shopify cleanup, orchestrator.
- `orders`: Pancake/Shopify webhook planning/execution, status mapper, Sapo log/top-order sync, Sapo→Pancake order sync.
- `address`: Sapo/Pancake address sync + mapping resolution.
- `sapo`, `pancake`, `shopify`: integration clients.
- `notifications`: Telegram notifier.

Important invariants:
- `sportswear-main/` is a read-only business-flow reference.
- Do not set Pancake inventory from Sapo order line quantity; product inventory sync is the authoritative Sapo→platform stock path.
- Pancake webhooks require `x-pancake-webhook-secret`; Shopify webhooks require HMAC raw-body verification.
- `/sync/*` is guarded by sync API token.
- Scheduled syncs use Redis lock `lock:sync:<syncType>` to prevent overlap of same sync type.
- Address sync has safety thresholds and transactional replacement.

Related: `mem:tech_stack`, `mem:conventions`, `mem:task_completion`.