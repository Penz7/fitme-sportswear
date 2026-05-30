# Java Business Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining Java-equivalent business loops for Sapo top-order tracking and Sapo log-driven order sync in `fitme-sportswear-backend`.

**Architecture:** Add focused NestJS services around existing order sync primitives instead of rewriting product/order clients. `SapoTopOrderSyncService` owns Java `processTopOrders` parity; `SapoLogSyncService` owns Java `BusinessLogService` parity; `SyncService`, queue producers/processors, and scheduler expose these flows as normal sync jobs.

**Tech Stack:** NestJS, Prisma, BullMQ, Jest, PostgreSQL Prisma migrations.

---

## File Structure

- Modify `fitme-sportswear-backend/prisma/schema.prisma`: add `SapoOrderTracking`.
- Create `fitme-sportswear-backend/prisma/migrations/20260530120000_sapo_order_tracking/migration.sql`: add SQL table.
- Modify `fitme-sportswear-backend/src/modules/sapo/sapo.client.ts`: add Sapo logs fetch API.
- Create `fitme-sportswear-backend/src/modules/orders/sapo-top-order-sync.service.ts`: top-order tracking and sync behavior.
- Create `fitme-sportswear-backend/src/modules/orders/sapo-log-sync.service.ts`: Sapo log extraction and idempotent sync behavior.
- Modify `fitme-sportswear-backend/src/modules/orders/orders.module.ts`: register new services.
- Modify `fitme-sportswear-backend/src/modules/queue/producers/sapo-to-pancake-order-sync.producer.ts`: support top-order/log job payloads.
- Modify `fitme-sportswear-backend/src/modules/queue/processors/sapo-to-pancake-order-sync.processor.ts`: dispatch single order, bulk orders, top orders, and Sapo logs.
- Modify `fitme-sportswear-backend/src/modules/sync/sync.service.ts`: create `SyncRun` helpers for top-order/log sync.
- Modify `fitme-sportswear-backend/src/modules/sync/sync.controller.ts`: expose manual trigger endpoints.
- Modify `fitme-sportswear-backend/src/modules/sync/scheduled-sync.processor.ts`, `sync-scheduler.service.ts`: support scheduled top-order/log sync.
- Add/modify Jest specs beside touched services.

## Tasks

### Task 1: Add Sapo order tracking persistence

- [ ] Write Prisma schema and migration for `SapoOrderTracking`.
- [ ] Add tests in `sapo-top-order-sync.service.spec.ts` that expect previously tracked order IDs to be skipped.
- [ ] Implement tracking read/update in `SapoTopOrderSyncService`.
- [ ] Run `npm test -- sapo-top-order-sync.service.spec.ts --runInBand`.

### Task 2: Add Sapo logs client and log sync service

- [ ] Write `sapo.client.spec.ts` coverage for `fetchLogs(1, 100)` URL and error handling.
- [ ] Implement `SapoClient.fetchLogs()`.
- [ ] Write `sapo-log-sync.service.spec.ts` for URI extraction, persisted idempotency, and order sync calls.
- [ ] Implement `SapoLogSyncService`.
- [ ] Run `npm test -- sapo.client.spec.ts sapo-log-sync.service.spec.ts --runInBand`.

### Task 3: Wire queue processor and sync API

- [ ] Extend producer payload union for `mode: "single" | "bulk" | "top-orders" | "sapo-logs"`.
- [ ] Add processor tests for `top-orders` and `sapo-logs`.
- [ ] Implement processor dispatch to new services.
- [ ] Add `SyncService` methods and controller endpoints.
- [ ] Run `npm test -- sapo-to-pancake-order-sync.processor.spec.ts sync.service.spec.ts --runInBand`.

### Task 4: Wire scheduler parity jobs

- [ ] Extend scheduled sync payload to include `sapo-top-order-sync` and `sapo-log-sync`.
- [ ] Add scheduler tests for repeatable job registration and processor dispatch.
- [ ] Implement env-driven cron registration.
- [ ] Run `npm test -- sync-scheduler.service.spec.ts scheduled-sync.processor.spec.ts --runInBand`.

### Task 5: Full verification and index

- [ ] Run `npm test -- --runInBand`.
- [ ] Run `npm run build`.
- [ ] Run `npm run lint`; if ESLint 9 config is still missing, report that as the known tooling issue.
- [ ] Run codebase index/search with `rg` to verify new business files and docs are discoverable.
