# Local Parity Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit `fitme-sportswear-backend` locally and determine whether it is functionally complete compared with `sportswear-main`.

**Architecture:** This is a read-only audit plan. It uses local repository indexing, local verification commands, and source-level parity comparison between NestJS modules and Java business services. The output is a concise report with evidence from files, tests, and command results.

**Tech Stack:** PowerShell, ripgrep, NestJS, TypeScript, Jest, Prisma, Java Spring source review.

---

## File Structure

- Read: `fitme-sportswear-backend/package.json` for verification scripts.
- Read: `fitme-sportswear-backend/src/` for NestJS modules, controllers, services, clients, processors, and tests.
- Read: `fitme-sportswear-backend/prisma/schema.prisma` and migrations for persistence parity.
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/` for Java business behavior.
- Read: `docs/superpowers/specs/` and `docs/superpowers/plans/` for migration intent and known acceptance criteria.
- Read: `docs/business-flow/sapo-pancake-shopify-flow-mapping.md` for business mapping notes.
- Produce in final response: audit result report. No repository file needs to be modified during execution.

## Task 1: Index Backend and Legacy Code

**Files:**
- Read: `fitme-sportswear-backend/src/`
- Read: `fitme-sportswear-backend/prisma/`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/`
- Read: `docs/superpowers/specs/`
- Read: `docs/superpowers/plans/`

- [ ] **Step 1: List tracked source files**

Run from repository root:

```powershell
rg --files
```

Expected: outputs files from `fitme-sportswear-backend`, `sportswear-main`, and `docs`.

- [ ] **Step 2: Count NestJS modules and tests**

Run from repository root:

```powershell
rg --files fitme-sportswear-backend/src | rg "\.module\.ts$|\.controller\.ts$|\.service\.ts$|\.processor\.ts$|\.producer\.ts$|\.spec\.ts$"
```

Expected: lists backend module, controller, service, processor, producer, and spec files.

- [ ] **Step 3: Count Java business classes**

Run from repository root:

```powershell
rg --files sportswear-main/src/main/java/vn/fitme/sportswear | rg "service|processor|controller|scheduler|repository|mapper|common|util|constant"
```

Expected: lists Java service, processor, controller, scheduler, repository, mapper, API client, utility, and constant files.

- [ ] **Step 4: Read migration docs**

Run from repository root:

```powershell
Get-Content docs\superpowers\specs\2026-05-30-java-business-parity-design.md
```

Expected: describes Java parity goals for product sync, Sapo top orders, Sapo logs, Sapo-to-Pancake orders, and Pancake webhooks.

## Task 2: Run Local Verification

**Files:**
- Read: `fitme-sportswear-backend/package.json`
- Execute in: `fitme-sportswear-backend/`

- [ ] **Step 1: Run Jest test suite**

Run:

```powershell
npm test -- --runInBand
```

Expected: either all tests pass, or failures are captured with failing spec names and assertion/error details.

- [ ] **Step 2: Run TypeScript/Nest build**

Run:

```powershell
npm run build
```

Expected: either build succeeds, or TypeScript/Nest errors are captured with file paths and messages.

- [ ] **Step 3: Run lint**

Run:

```powershell
npm run lint
```

Expected: either lint succeeds, fails because ESLint 9 flat config is missing, or fails with source-level lint errors. Classify the result explicitly.

## Task 3: Audit Product and Inventory Parity

**Files:**
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/BusinessProductService.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/sapo/SapoService.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/pancake/PancakeService.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/shopify_v2/ShopifyService.java`
- Read: `fitme-sportswear-backend/src/modules/products/`
- Read: `fitme-sportswear-backend/src/modules/sapo/`
- Read: `fitme-sportswear-backend/src/modules/pancake/`
- Read: `fitme-sportswear-backend/src/modules/shopify/`

- [ ] **Step 1: Locate Java product sync behavior**

Run:

```powershell
rg -n "syncProducts|updateInventory|available|Shopify|Pancake" sportswear-main/src/main/java/vn/fitme/sportswear/service sportswear-main/src/main/java/vn/fitme/sportswear/mapper sportswear-main/src/main/java/vn/fitme/sportswear/util
```

Expected: identifies Java product sync, matching, inventory update, and platform mapping code.

- [ ] **Step 2: Locate NestJS product sync behavior**

Run:

```powershell
rg -n "ProductSync|InventorySync|ProductSnapshot|matching|conflict|updateInventory|fetchProducts" fitme-sportswear-backend/src/modules/products fitme-sportswear-backend/src/modules/sapo fitme-sportswear-backend/src/modules/pancake fitme-sportswear-backend/src/modules/shopify
```

Expected: identifies NestJS product snapshot, matching, conflict, inventory update, and client code.

- [ ] **Step 3: Classify parity**

Record whether NestJS has product sync from Sapo to Pancake/Shopify, test coverage, conflict handling, startup/scheduled sync, and real platform clients. Use file paths and command output as evidence.

## Task 4: Audit Order, Webhook, and Status Parity

**Files:**
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/BusinessOrderService.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/BusinessLogService.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/processor/`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/controller/`
- Read: `fitme-sportswear-backend/src/modules/orders/`
- Read: `fitme-sportswear-backend/src/modules/webhook/`
- Read: `fitme-sportswear-backend/src/modules/queue/`
- Read: `fitme-sportswear-backend/src/modules/sync/`

- [ ] **Step 1: Locate Java order and webhook behavior**

Run:

```powershell
rg -n "processTopOrders|createOrUpdateOrder|handleBySapoLogs|OrderCreatedProcessor|OrderUpdatedProcessor|InventoryCheckProcessor|StockInboundProcessor|Webhook" sportswear-main/src/main/java/vn/fitme/sportswear
```

Expected: identifies Java Sapo polling, log polling, Pancake webhook processors, Shopify webhook controller, and status processors.

- [ ] **Step 2: Locate NestJS order and webhook behavior**

Run:

```powershell
rg -n "SapoTopOrder|SapoLog|SapoToPancake|OrderWebhook|Pancake|Shopify|Webhook|status|fulfillment|prepayment|customer" fitme-sportswear-backend/src/modules/orders fitme-sportswear-backend/src/modules/webhook fitme-sportswear-backend/src/modules/queue fitme-sportswear-backend/src/modules/sync
```

Expected: identifies NestJS order sync, Sapo top-order/log sync, webhook ingestion/processing, queue dispatch, status mapping, and tests.

- [ ] **Step 3: Classify parity**

Record whether NestJS covers Sapo-to-Pancake create/update, Pancake-to-Sapo lifecycle updates, Sapo logs, top-order polling, idempotency, Shopify webhook behavior, fulfillment behavior, prepayment/customer creation, and tests.

## Task 5: Audit Address, Customer, Notification, and Scheduler Parity

**Files:**
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/service/BusinessAddressService.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/common/thirdapp/`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/scheduler/BusinessScheduler.java`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/runner/StartupRunner.java`
- Read: `fitme-sportswear-backend/src/modules/address/`
- Read: `fitme-sportswear-backend/src/modules/notifications/`
- Read: `fitme-sportswear-backend/src/modules/sync/`

- [ ] **Step 1: Locate Java supporting flows**

Run:

```powershell
rg -n "BusinessAddressService|Telegram|Gemini|BusinessScheduler|StartupRunner|Customer" sportswear-main/src/main/java/vn/fitme/sportswear
```

Expected: identifies Java address, third-party notification/AI, scheduler, startup, and customer behavior.

- [ ] **Step 2: Locate NestJS supporting flows**

Run:

```powershell
rg -n "Address|Telegram|Gemini|Scheduler|Startup|Customer|cron|repeatable" fitme-sportswear-backend/src/modules fitme-sportswear-backend/src
```

Expected: identifies NestJS address sync, notification, scheduler, startup sync, and customer-related behavior where present.

- [ ] **Step 3: Classify parity**

Record whether NestJS covers address mapping/sync, customer creation, Telegram notifications, Gemini behavior, scheduled jobs, and startup product sync.

## Task 6: Audit Persistence and API Surface

**Files:**
- Read: `fitme-sportswear-backend/prisma/schema.prisma`
- Read: `fitme-sportswear-backend/prisma/migrations/`
- Read: `fitme-sportswear-backend/src/modules/sync/sync.controller.ts`
- Read: `fitme-sportswear-backend/src/modules/webhook/webhook.controller.ts`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/repository/`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/repository/entity/`
- Read: `sportswear-main/src/main/java/vn/fitme/sportswear/controller/`

- [ ] **Step 1: Locate persistence models**

Run:

```powershell
rg -n "model |@@map|webhook|sync|mapping|Product|Order|Tracking|Idempotency" fitme-sportswear-backend/prisma/schema.prisma fitme-sportswear-backend/prisma/migrations
```

Expected: identifies Prisma models and migration tables for operational and business persistence.

- [ ] **Step 2: Locate API routes**

Run:

```powershell
rg -n "@Controller|@Get|@Post|@Put|@Delete|@Patch" fitme-sportswear-backend/src sportswear-main/src/main/java/vn/fitme/sportswear/controller
```

Expected: identifies NestJS and Java API/controller surface for comparison.

- [ ] **Step 3: Classify parity**

Record whether NestJS has persistence for Java repositories/entities, operational sync logs, webhook events, idempotency, product snapshots, order mappings, Sapo order tracking, and exposed manual sync endpoints.

## Task 7: Produce Final Audit Report

**Files:**
- Use evidence collected from Tasks 1-6.
- Produce in final response.

- [ ] **Step 1: Summarize verification**

Report pass/fail for:

```text
npm test -- --runInBand
npm run build
npm run lint
```

Include exact failure categories if any command fails.

- [ ] **Step 2: Summarize parity**

Use these headings:

```text
Đã có và có test
Đã có nhưng cần kiểm chứng thêm
Thiếu so với Java
Rủi ro/tooling/blocker
```

Under each heading, include concise bullets with supporting file paths.

- [ ] **Step 3: Answer replacement readiness**

State one of:

```text
Backend mới đủ điều kiện thay Java cho phạm vi local đã kiểm tra.
Backend mới gần đủ nhưng cần kiểm chứng live integration trước khi thay Java.
Backend mới chưa đủ thay Java vì còn thiếu các flow cụ thể.
```

The answer must be backed by the parity findings and verification command results.

## Self-Review

- Spec coverage: This plan covers indexing, local verification, source parity, persistence/API surface, and final reporting.
- Placeholder scan: The plan contains exact commands and expected outputs, with no deferred implementation steps.
- Scope consistency: The plan is read-only and does not call external APIs, run live infrastructure, or change application logic.
