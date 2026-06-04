# Backend Core

- Path: `fitme-sportswear-backend`.
- NestJS modules under `src/modules`: address, config, database, health, notifications, orders, pancake, products, queue, sapo, shopify, sync, webhook.
- Queue layer uses BullMQ with `queue/` constants/module plus processors/producers; worker entrypoint is `src/worker.ts` and `npm run worker:dev` runs it directly.
- Prisma schema models sync runs, webhook events, idempotency keys, external mappings, platform product snapshots, product mappings, order mappings, Sapo order tracking, and administrative address mappings.
- Domain clients exist for Sapo/Pancake/Shopify; sync/order/product/address services compose platform clients with persistence and queue processing.
- Tests are colocated as `*.spec.ts` beside services/clients/mappers.