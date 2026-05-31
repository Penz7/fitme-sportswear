# Local Parity Audit Design

## Goal

Audit `fitme-sportswear-backend` locally against the legacy Java `sportswear-main` codebase. The audit should determine whether the NestJS backend builds, tests, and exposes the expected migrated behavior, and whether it is functionally complete compared with the old Java implementation.

## Scope

In scope:

- Index the repository using local search commands.
- Map the NestJS backend modules, routes, queues, processors, schedulers, Prisma schema, migrations, and tests.
- Run local verification for tests, build, and lint.
- Compare implemented NestJS business flows with the Java source and existing migration docs.
- Produce a concise parity report with implemented, partially implemented, missing, and risky areas.

Out of scope:

- Calling real Sapo, Pancake, Shopify, Telegram, or Gemini APIs.
- Running Docker, Postgres, Redis, API server, or worker as a live integration environment.
- Changing application logic.
- Deploying the backend.
- Treating missing live credentials as a failure.

## Audit Inputs

Primary codebases:

- `fitme-sportswear-backend/`: new NestJS backend.
- `sportswear-main/`: legacy Java Spring backend used as the business reference.

Supporting docs:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `docs/business-flow/sapo-pancake-shopify-flow-mapping.md`
- `docs/deployment/`
- `tai-lieu-trien-khai/`

## Verification Commands

Run from `fitme-sportswear-backend/`:

```text
npm test -- --runInBand
npm run build
npm run lint
```

If `npm run lint` fails because the project still lacks an ESLint 9 flat config, report it as a tooling issue. If it fails on source-level lint errors, report the exact failing files and rules.

## Codebase Index

Use local search rather than external tools:

```text
rg --files
rg -n "<business term>"
```

The index should cover:

- NestJS modules and controllers.
- BullMQ queue producers and processors.
- Scheduler jobs.
- Prisma models and migrations.
- Platform clients for Sapo, Pancake, and Shopify.
- Tests for products, orders, address mapping, webhook ingestion, scheduler, and clients.
- Java source services, processors, mappers, clients, schedulers, repositories, and constants.

## Parity Areas

Compare these Java business areas with the NestJS implementation:

- Product sync from Sapo snapshots to Pancake and Shopify inventory.
- Product matching and conflict handling.
- Sapo top-order polling and tracking.
- Sapo log polling and idempotent order reprocessing.
- Sapo-to-Pancake order creation/update behavior.
- Pancake webhook ingestion and order lifecycle behavior toward Sapo.
- Shopify webhook and order/fulfillment behavior.
- Address mapping/sync.
- Customer creation behavior.
- Inventory impact rules and status mapping.
- Telegram notifications.
- Gemini/address normalization behavior if still present in Java.
- Scheduler/startup behavior.
- Persistence parity for mappings, sync runs, webhook events, product snapshots, and tracking tables.

## Reporting Format

The final report should group findings as:

- `Đã có và có test`
- `Đã có nhưng cần kiểm chứng thêm`
- `Thiếu so với Java`
- `Rủi ro/tooling/blocker`

Each conclusion should name the local files or tests that support it. Verification command results should include pass/fail status and the important error details when failing.

## Success Criteria

- The backend has been indexed with local search.
- Local test, build, and lint commands have been run or clearly blocked.
- Major Java business flows have been compared against NestJS files.
- The final report clearly answers whether `fitme-sportswear-backend` is complete relative to `sportswear-main`, and what remains before it can replace the Java backend.
