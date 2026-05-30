# Deployment Docs and Business Flow Mapping Design

## Context

The legacy deployment document lives at `tai-lieu-trien-khai/1.Tiliuphntchkthutvtrinkhai.docx.html`. It documents the old Java deployment flow and important Sapo/Pancake business synchronization rules. The new system is `fitme-sportswear-backend`, a NestJS modular monolith with Docker Compose, PostgreSQL, Redis, BullMQ, Prisma, an API process, and a worker process.

The legacy document must remain as historical reference. New documentation should be created at the root `docs/` folder so it matches the new root-level backend source.

## Goals

- Create a new NestJS local deployment guide for the current backend foundation.
- Create a business flow mapping document that preserves old Sapo/Pancake/Shopify rules for future migration phases.
- Avoid editing the legacy HTML document directly.
- Make explicit which legacy flows are already supported by the new foundation and which remain future migration acceptance criteria.

## Documents to create

### `docs/deployment/nestjs-local-deployment.md`

Purpose: explain how to run and verify the new NestJS backend locally.

Required sections:

- Overview of local services: `postgres`, `redis`, `api`, `worker`.
- Prerequisites: Docker Desktop running; Node.js/npm only required for non-Docker commands.
- Environment setup: copy `.env.example` to `.env` in `fitme-sportswear-backend/`.
- Docker Compose startup commands.
- Prisma migration commands.
- Verification commands for:
  - `GET /health`
  - `GET /health/readiness`
  - `GET /config/public`
  - `POST /sync/test`
  - `GET /sync/test/:id`
- Troubleshooting notes for issues already observed:
  - Docker daemon not running.
  - Container-to-container DB/Redis hostnames must use `postgres:5432` and `redis:6379`, not `localhost`.
  - Prisma client must be generated before runtime image starts.
- Clear statement that this guide is for the new NestJS backend, not the old Java `.jar` deployment.

### `docs/business-flow/sapo-pancake-shopify-flow-mapping.md`

Purpose: preserve legacy business flow rules as migration acceptance criteria for the new backend.

Required sections:

- Source reference: legacy deployment document path.
- Current new-system status: foundation exists, real product/order/customer/inventory sync is not implemented yet.
- Pancake setup flow:
  - Configure `api_key`.
  - Configure webhook URL.
  - Legacy webhook URL shape was `http://ip:port/webhook`; new NestJS target should become a versioned webhook route when implemented.
- Sapo setup flow:
  - Legacy uses full-permission user/pass.
  - New backend should store credentials/secrets in `.env` or a future secret manager, never in docs/logs.
- Order status mapping:
  - Sapo `Đặt hàng`, `Duyệt`, `Đóng gói` affect only sellable quantity.
  - Sapo `Xuất kho`, `Hoàn thành` affect inventory quantity.
  - Sapo `Hủy đơn` affects both inventory and sellable quantity.
  - Pancake `Mới`, `Chờ hàng`, `Ưu tiên xuất đơn`, `Đã xác nhận`, `Đang đóng hàng` affect only sellable quantity.
  - Pancake `Chờ chuyển hàng`, `Đã gửi hàng`, `Đã nhận`, `Đã thu tiền` affect inventory quantity.
  - Pancake `Đã hoàn toàn bộ`, `Đã hủy` affect both inventory and sellable quantity.
- Special rules:
  - Pancake `Đã xác nhận` maps to Sapo shipping handoff through ViettelPost.
  - Pancake `Chờ hàng` maps to Sapo `Chờ duyệt`.
  - Orders created on Pancake are sent through ViettelPost in the legacy flow.
  - Newly created paid orders must still be `Mới` on Pancake, same as unpaid new orders.
- Migration acceptance criteria:
  - Future product/order/customer/inventory sync phases must implement tests around these mappings.
  - Worker jobs must be idempotent and retryable.
  - Webhook handling must persist event payload/status before processing.

## Out of scope

- Do not modify the legacy HTML document.
- Do not implement real business sync in this documentation task.
- Do not add admin UI or production cloud deployment instructions.
- Do not expose secrets in the new documentation.

## Validation

After writing the documents:

- Verify both files exist under root `docs/`.
- Search the new docs for unfinished markers or leaked sample secrets beyond clearly marked placeholders.
- Confirm the old flow rules from the legacy document are represented in the mapping document.
