# Deployment Docs Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create two root-level documents: a NestJS local deployment guide and a Sapo/Pancake/Shopify business flow mapping guide that preserves legacy flow rules.

**Architecture:** Keep the legacy HTML deployment document unchanged and create new Markdown documents under root `docs/`. The deployment document describes how to run the new NestJS backend locally; the flow mapping document translates legacy Sapo/Pancake/Shopify rules into future migration acceptance criteria.

**Tech Stack:** Markdown documentation, Docker Compose, NestJS, Prisma, PostgreSQL, Redis, BullMQ.

---

## File structure

Create these files:

```text
C:\Users\tanda\Downloads\fitme-sportswear\docs\deployment\nestjs-local-deployment.md
C:\Users\tanda\Downloads\fitme-sportswear\docs\business-flow\sapo-pancake-shopify-flow-mapping.md
```

Do not modify:

```text
C:\Users\tanda\Downloads\fitme-sportswear\tai-lieu-trien-khai\1.Tiliuphntchkthutvtrinkhai.docx.html
```

---

### Task 1: Create NestJS local deployment guide

**Files:**
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\docs\deployment\nestjs-local-deployment.md`

- [ ] **Step 1: Create the deployment docs directory**

Run:

```bash
mkdir -p 'C:\Users\tanda\Downloads\fitme-sportswear\docs\deployment'
```

Expected: directory exists.

- [ ] **Step 2: Write the deployment guide**

Create `docs/deployment/nestjs-local-deployment.md` with this content:

```markdown
# NestJS Local Deployment Guide

## Mục đích

Tài liệu này hướng dẫn chạy hệ thống backend mới `fitme-sportswear-backend` trên môi trường local/nội bộ. Tài liệu này thay thế phần triển khai Java `.jar` cho backend mới, nhưng không xóa hoặc chỉnh sửa tài liệu triển khai cũ trong `tai-lieu-trien-khai/`.

Backend mới hiện là phase foundation gồm:

- NestJS API service.
- BullMQ worker service.
- PostgreSQL database riêng.
- Redis cho queue/cache/coordination.
- Prisma migration.
- Health/config/test sync endpoints.

Phase này chưa triển khai đồng bộ nghiệp vụ thật cho sản phẩm, đơn hàng, khách hàng, tồn kho hoặc webhook thật.

## Cấu trúc service local

Docker Compose chạy các service sau:

```text
postgres -> PostgreSQL 16, expose ra máy host tại localhost:5433
redis    -> Redis 7, expose ra máy host tại localhost:6380
api      -> NestJS HTTP API, expose tại localhost:3000
worker   -> BullMQ worker xử lý job nền
```

Trong container, `api` và `worker` kết nối nội bộ bằng hostname Docker Compose:

```text
DATABASE_URL=postgresql://fitme:fitme@postgres:5432/fitme_sportswear_backend?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
```

Khi chạy lệnh trực tiếp từ máy host, `.env` dùng cổng expose ra host:

```text
DATABASE_URL=postgresql://fitme:fitme@localhost:5433/fitme_sportswear_backend?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
```

## Yêu cầu môi trường

- Docker Desktop đã chạy.
- Node.js/npm chỉ cần khi chạy lệnh ngoài Docker như `npm run build`, `npm run test:e2e`, hoặc `npm run prisma:migrate`.

Kiểm tra Docker:

```bash
docker version
docker compose version
```

Nếu Docker chưa chạy, các lệnh Compose sẽ lỗi tương tự:

```text
failed to connect to the docker API
```

## Chuẩn bị cấu hình

Đi vào backend mới:

```bash
cd 'C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend'
```

Tạo `.env` từ mẫu:

```bash
cp .env.example .env
```

Các giá trị placeholder như `change-me` chỉ dùng cho local foundation. Khi triển khai sync thật, token/API key phải thay bằng giá trị thật và không được commit/log ra ngoài.

## Chạy PostgreSQL và Redis

```bash
docker compose up -d postgres redis
```

Kiểm tra trạng thái:

```bash
docker compose ps
```

Kỳ vọng:

```text
postgres   Up   0.0.0.0:5433->5432/tcp
redis      Up   0.0.0.0:6380->6379/tcp
```

## Chạy Prisma migration từ máy host

```bash
npm run prisma:migrate -- --name init
```

Kỳ vọng:

```text
Your database is now in sync with your schema.
Generated Prisma Client
```

Nếu vừa tạo container PostgreSQL lần đầu và migration báo không kết nối được, kiểm tra logs PostgreSQL rồi chạy lại:

```bash
docker compose logs postgres --tail=80
npm run prisma:migrate -- --name init
```

## Build và chạy test e2e

```bash
npm run build
npm run test:e2e
```

Kỳ vọng:

```text
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

Bộ e2e hiện kiểm tra:

- `GET /health`
- `GET /health/readiness`
- `GET /config/public`
- `POST /sync/test`
- `GET /sync/test/:id`

## Chạy full stack bằng Docker Compose

```bash
docker compose up --build -d api worker
```

Kiểm tra container:

```bash
docker compose ps
```

Kỳ vọng:

```text
api       Up   0.0.0.0:3000->3000/tcp
worker    Up
postgres  Up   0.0.0.0:5433->5432/tcp
redis     Up   0.0.0.0:6380->6379/tcp
```

Kiểm tra logs:

```bash
docker compose logs api --tail=80
docker compose logs worker --tail=80
```

Kỳ vọng API có log:

```text
Nest application successfully started
Mapped {/health, GET} route
Mapped {/sync/test, POST} route
```

Kỳ vọng worker có log:

```text
Worker started
```

## Kiểm tra endpoint

Health:

```bash
curl http://localhost:3000/health
```

Kỳ vọng:

```json
{"status":"ok","service":"fitme-sportswear-backend","version":"0.1.0","environment":"local"}
```

Readiness:

```bash
curl http://localhost:3000/health/readiness
```

Kỳ vọng:

```json
{"status":"ready","dependencies":{"database":"ok"}}
```

Public config:

```bash
curl http://localhost:3000/config/public
```

Kỳ vọng có `test-sync`, `sapo`, `pancake`, `shopify` và không có token/API key/database URL.

Tạo test sync job:

```bash
curl -X POST http://localhost:3000/sync/test -H "Content-Type: application/json" -d "{\"message\":\"manual local test\"}"
```

Kỳ vọng trả về:

```json
{"id":"<sync-run-id>","status":"queued","syncType":"test-sync"}
```

Kiểm tra trạng thái job:

```bash
curl http://localhost:3000/sync/test/<sync-run-id>
```

Kỳ vọng sau một thời gian ngắn:

```json
{"status":"succeeded","syncType":"test-sync"}
```

## Troubleshooting

### Docker daemon chưa chạy

Triệu chứng:

```text
failed to connect to the docker API
```

Cách xử lý:

- Mở Docker Desktop.
- Chờ Docker báo running.
- Chạy lại `docker compose ps`.

### Prisma từ container không kết nối được database

Triệu chứng trong logs `api` hoặc `worker`:

```text
Error: P1001: Can't reach database server at `localhost:5433`
```

Nguyên nhân: trong container, `localhost` là chính container đó, không phải service PostgreSQL.

Cấu hình đúng trong `docker-compose.yml` cho `api` và `worker`:

```text
DATABASE_URL=postgresql://fitme:fitme@postgres:5432/fitme_sportswear_backend?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
```

### Prisma client chưa được generate trong runtime image

Triệu chứng:

```text
@prisma/client did not initialize yet. Please run "prisma generate"
```

Cách xử lý: Docker runtime image phải copy `node_modules` từ build stage sau khi chạy `npm run prisma:generate`.

### Docker build context quá lớn

Triệu chứng: build mất nhiều thời gian vì gửi cả `node_modules` hoặc `dist` vào context.

Cách xử lý: `.dockerignore` phải loại trừ:

```text
node_modules
dist
coverage
.env
.env.local
.git
.superpowers
```

## Khác biệt với triển khai Java cũ

Triển khai Java cũ dùng:

```text
JDK 21
sportswear-0.0.1-SNAPSHOT.jar
application.yaml
nohup java -jar ...
```

Backend mới dùng:

```text
Docker Compose
NestJS API container
BullMQ worker container
Prisma migrations
PostgreSQL riêng
Redis
```

Tài liệu triển khai Java cũ vẫn được giữ nguyên làm lịch sử tham chiếu tại `tai-lieu-trien-khai/`.
```

- [ ] **Step 3: Verify deployment guide contains required commands**

Run:

```bash
python - <<'PY'
from pathlib import Path
p=Path(r'C:\Users\tanda\Downloads\fitme-sportswear\docs\deployment\nestjs-local-deployment.md')
text=p.read_text(encoding='utf-8')
required=['docker compose up -d postgres redis','npm run prisma:migrate -- --name init','npm run test:e2e','docker compose up --build -d api worker','/health','/health/readiness','/config/public','/sync/test']
missing=[s for s in required if s not in text]
print('missing=', missing)
raise SystemExit(1 if missing else 0)
PY
```

Expected: `missing= []` and exit code 0.

---

### Task 2: Create business flow mapping guide

**Files:**
- Create: `C:\Users\tanda\Downloads\fitme-sportswear\docs\business-flow\sapo-pancake-shopify-flow-mapping.md`

- [ ] **Step 1: Create the business-flow docs directory**

Run:

```bash
mkdir -p 'C:\Users\tanda\Downloads\fitme-sportswear\docs\business-flow'
```

Expected: directory exists.

- [ ] **Step 2: Write the business flow mapping guide**

Create `docs/business-flow/sapo-pancake-shopify-flow-mapping.md` with this content:

```markdown
# Sapo - Pancake - Shopify Business Flow Mapping

## Mục đích

Tài liệu này giữ lại các flow nghiệp vụ quan trọng từ hệ thống Java cũ để dùng làm tiêu chí migration cho backend NestJS mới.

Nguồn tham chiếu cũ:

```text
tai-lieu-trien-khai/1.Tiliuphntchkthutvtrinkhai.docx.html
```

Backend mới:

```text
fitme-sportswear-backend/
```

Trạng thái hiện tại của backend mới:

- Đã có foundation NestJS, PostgreSQL, Redis, BullMQ, API và worker.
- Đã có health/config/test sync endpoints.
- Chưa triển khai sync nghiệp vụ thật cho product/order/customer/inventory/webhook.

## Nguyên tắc migration

- Không làm mất flow nghiệp vụ cũ khi chuyển từ Java sang NestJS.
- Mỗi flow thật sau này phải được migrate theo vertical slice riêng.
- Mỗi mapping trạng thái phải có test hoặc checklist đối chiếu.
- Worker job phải idempotent và retry được.
- Webhook phải lưu payload/trạng thái trước khi xử lý nghiệp vụ.
- Token/API key/user/pass không được ghi vào tài liệu, log hoặc commit.

## Pancake setup flow

Theo tài liệu cũ, trên Pancake cần cấu hình:

- `api_key`
- webhook URL ở chức năng cấu hình

Legacy webhook URL có dạng:

```text
http://ip:port/webhook
```

Với backend NestJS mới, route webhook thật chưa được triển khai trong phase foundation. Khi migrate webhook thật, nên dùng route rõ nguồn và version, ví dụ:

```text
http://ip:3000/webhooks/pancake/v1
```

Acceptance criteria khi triển khai Pancake webhook:

- Xác thực request bằng secret/API key phù hợp.
- Lưu bản ghi `webhook_events` trước khi xử lý.
- Chống xử lý trùng bằng idempotency key.
- Enqueue job xử lý qua BullMQ thay vì xử lý nặng ngay trong HTTP request.
- HTTP response trả nhanh sau khi nhận hợp lệ.

## Sapo setup flow

Theo tài liệu cũ, Sapo dùng user/pass có full quyền của hệ thống.

Với backend NestJS mới:

- Credential phải nằm trong `.env` hoặc secret manager ở phase sau.
- Không log credential.
- Connector `sapo` chỉ phụ trách gọi Sapo API.
- Business sync giữa Sapo/Pancake/Shopify phải nằm trong module `sync`, không nằm trực tiếp trong connector.

Acceptance criteria khi triển khai Sapo connector thật:

- Cấu hình fail fast nếu thiếu credential.
- Có test cho auth/config loading.
- Có retry/backoff cho lỗi tạm thời.
- Có phân loại lỗi business và transient.

## Mapping trạng thái Sapo

| Trạng thái Sapo | Ảnh hưởng nghiệp vụ |
| --- | --- |
| Đặt hàng | Chỉ thay đổi số có thể bán |
| Duyệt | Chỉ thay đổi số có thể bán |
| Đóng gói | Chỉ thay đổi số có thể bán |
| Xuất kho | Thay đổi số tồn |
| Hoàn thành | Thay đổi số tồn |
| Hủy đơn | Thay đổi số tồn và số có thể bán |

Ghi chú từ tài liệu cũ:

```text
Danh sách + Nhập hàng -> Nếu thay đổi -> thay đổi
```

Nội dung này cần được làm rõ khi migrate inventory/import flow. Trước khi implement, cần xác định chính xác entity/event nào từ Sapo đại diện cho `Danh sách + Nhập hàng`.

## Mapping trạng thái Pancake

| Trạng thái Pancake | Ảnh hưởng nghiệp vụ |
| --- | --- |
| Mới | Chỉ thay đổi số có thể bán |
| Chờ hàng | Chỉ thay đổi số có thể bán |
| Ưu tiên xuất đơn | Chỉ thay đổi số có thể bán |
| Đã xác nhận | Chỉ thay đổi số có thể bán |
| Đang đóng hàng | Chỉ thay đổi số có thể bán |
| Chờ chuyển hàng | Thay đổi số tồn |
| Đã gửi hàng | Thay đổi số tồn |
| Đã nhận | Thay đổi số tồn |
| Đã thu tiền | Thay đổi số tồn |
| Đã hoàn toàn bộ | Thay đổi số tồn và số có thể bán |
| Đã hủy | Thay đổi số tồn và số có thể bán |

## Quy tắc đặc biệt từ flow cũ

### Pancake `Đã xác nhận` sang Sapo shipping handoff

```text
Trạng thái Pancake: Đã xác nhận -> Trạng thái Sapo: Đẩy qua hãng vận chuyển
```

Theo tài liệu cũ, hãng vận chuyển là:

```text
ViettelPost: Cam kết sản lượng 07
```

Acceptance criteria khi migrate order sync:

- Khi đơn Pancake chuyển sang `Đã xác nhận`, backend mới phải tạo/cập nhật trạng thái tương ứng bên Sapo để đẩy qua hãng vận chuyển.
- Nếu carrier vẫn là ViettelPost mặc định, cấu hình carrier phải nằm trong env/config, không hard-code rải rác.
- Nếu sau này Pancake chọn được hãng vận chuyển, mapping carrier Pancake -> Sapo phải là bảng cấu hình riêng.

### Pancake `Chờ hàng` sang Sapo `Chờ duyệt`

```text
Trạng thái Pancake: Chờ hàng -> Trạng thái Sapo: Chờ duyệt
```

Acceptance criteria khi migrate order sync:

- Có test cho trạng thái `Chờ hàng`.
- Không đẩy đơn qua vận chuyển khi đơn còn `Chờ hàng`.
- Ghi rõ trạng thái sync trong `sync_runs` nếu thiếu mapping.

### Đơn Pancake đi ViettelPost

Tài liệu cũ ghi:

```text
Đơn tạo trên Pancake tất cả đều đẩy qua bên vận chuyển ViettelPost
```

Acceptance criteria:

- Default carrier cho order từ Pancake là ViettelPost cho đến khi có yêu cầu business mới.
- Nếu carrier không cấu hình được, worker phải fail dạng business error, không retry vô hạn.

### Đơn mới đã thanh toán vẫn là `Mới` trên Pancake

Tài liệu cũ bổ sung:

```text
Đơn hàng tạo mới (đã thanh toán) - trạng thái tại Pancake phải là Mới tương tự như đơn chưa thanh toán
```

Acceptance criteria:

- Payment status không được tự động làm thay đổi initial Pancake order status.
- Đơn mới đã thanh toán và chưa thanh toán đều tạo với trạng thái Pancake `Mới`.
- Payment status phải được lưu riêng khỏi order lifecycle status.

## Luồng đồng bộ tồn kho

Tài liệu cũ có tiêu đề `Luồng đồng bộ tồn kho` nhưng chưa mô tả chi tiết đầy đủ.

Khi migrate inventory sync, cần làm rõ:

- Source of truth tồn kho là Sapo, Pancake hay Shopify.
- Phân biệt `số tồn` và `số có thể bán` trong model mới.
- Event nào làm tăng/giảm từng loại số lượng.
- Cách xử lý hoàn/hủy/nhập hàng.
- Cách đối soát khi API ngoài trả dữ liệu lệch.

Acceptance criteria tối thiểu cho phase inventory sau này:

- Có bảng mapping trạng thái -> loại quantity affected.
- Có test cho từng trạng thái trong tài liệu này.
- Có idempotency để cùng một webhook/order event không trừ tồn hai lần.
- Có sync run log đủ để debug local.

## Shopify trong hệ thống mới

Tài liệu cũ tập trung vào Sapo - Pancake, nhưng codebase cũ và backend mới đều giữ Shopify như một platform connector.

Trong phase mới:

- Shopify connector tồn tại dưới module `shopify`.
- Chưa triển khai business sync thật.
- Khi migrate flow Shopify, phải tạo mapping riêng tương tự Sapo/Pancake và không trộn logic trực tiếp vào connector.

## Mapping sang kiến trúc NestJS mới

| Legacy concept | NestJS foundation hiện tại | Khi migrate nghiệp vụ thật |
| --- | --- | --- |
| Java `.jar` service | `api` container + `worker` container | Giữ API nhận request nhanh, worker xử lý sync |
| `application.yaml` | `.env` + config validation | Secret manager nếu cần |
| PostgreSQL cũ | PostgreSQL riêng của backend mới | Không đọc DB Java cũ |
| Pancake webhook `/webhook` | `webhook` module placeholder | Route versioned như `/webhooks/pancake/v1` |
| Đồng bộ đơn hàng | Chưa implement | `sync` module + BullMQ queue |
| Đồng bộ tồn kho | Chưa implement | `sync` module + idempotent worker jobs |
| API clients Sapo/Pancake/Shopify | Connector shells | Typed clients có retry/rate-limit |

## Thứ tự migration đề xuất

1. Product sync.
2. Customer sync.
3. Order sync và webhooks.
4. Inventory/fulfillment.

Order/inventory là phần nhạy cảm nhất vì ảnh hưởng số tồn và số có thể bán. Không nên migrate order/inventory trước khi có test mapping trạng thái.

## Checklist trước khi migrate một flow thật

Với mỗi flow, cần có:

- Mô tả source event hoặc API polling.
- Mapping trạng thái đầy đủ.
- Idempotency key.
- Queue name và retry policy.
- Bảng dữ liệu hoặc log cần ghi.
- Test cho happy path.
- Test cho duplicate event.
- Test cho lỗi transient.
- Test cho lỗi business không retry vô hạn.
- Cách đối chiếu với flow Java cũ.
```

- [ ] **Step 3: Verify old flow rules are represented**

Run:

```bash
python - <<'PY'
from pathlib import Path
p=Path(r'C:\Users\tanda\Downloads\fitme-sportswear\docs\business-flow\sapo-pancake-shopify-flow-mapping.md')
text=p.read_text(encoding='utf-8')
required=['Đặt hàng','Duyệt','Đóng gói','Xuất kho','Hoàn thành','Hủy đơn','Mới','Chờ hàng','Ưu tiên xuất đơn','Đã xác nhận','Đang đóng hàng','Chờ chuyển hàng','Đã gửi hàng','Đã nhận','Đã thu tiền','Đã hoàn toàn bộ','Đã hủy','ViettelPost','đã thanh toán','webhook_events','idempotency']
missing=[s for s in required if s not in text]
print('missing=', missing)
raise SystemExit(1 if missing else 0)
PY
```

Expected: `missing= []` and exit code 0.

---

### Task 3: Final documentation verification

**Files:**
- Verify: `C:\Users\tanda\Downloads\fitme-sportswear\docs\deployment\nestjs-local-deployment.md`
- Verify: `C:\Users\tanda\Downloads\fitme-sportswear\docs\business-flow\sapo-pancake-shopify-flow-mapping.md`

- [ ] **Step 1: Verify files exist and no unfinished markers are present**

Run:

```bash
python - <<'PY'
from pathlib import Path
files=[
 Path(r'C:\Users\tanda\Downloads\fitme-sportswear\docs\deployment\nestjs-local-deployment.md'),
 Path(r'C:\Users\tanda\Downloads\fitme-sportswear\docs\business-flow\sapo-pancake-shopify-flow-mapping.md'),
]
bad_tokens=['TB' + 'D','TO' + 'DO','?' * 3,'implement ' + 'later','fill in ' + 'details']
for p in files:
    if not p.exists():
        print('missing file', p)
        raise SystemExit(1)
    text=p.read_text(encoding='utf-8')
    found=[m for m in bad_tokens if m.lower() in text.lower()]
    print(p, 'lines=', len(text.splitlines()), 'markers=', found)
    if found:
        raise SystemExit(1)
PY
```

Expected: both files exist, marker lists are empty, exit code 0.

- [ ] **Step 2: Verify legacy HTML was not modified**

Run:

```bash
python - <<'PY'
from pathlib import Path
p=Path(r'C:\Users\tanda\Downloads\fitme-sportswear\tai-lieu-trien-khai\1.Tiliuphntchkthutvtrinkhai.docx.html')
print('legacy_exists=', p.exists())
print('legacy_size=', p.stat().st_size if p.exists() else 0)
raise SystemExit(0 if p.exists() and p.stat().st_size > 0 else 1)
PY
```

Expected: `legacy_exists= True`, size greater than 0, exit code 0.

- [ ] **Step 3: Commit if repository exists**

Run:

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' status --short
```

Expected: if this is not a git repository, command exits 128 and no commit is possible. If it is a git repository, commit only the two new docs and the plan/spec docs:

```bash
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' add docs/deployment/nestjs-local-deployment.md docs/business-flow/sapo-pancake-shopify-flow-mapping.md docs/superpowers/specs/2026-05-30-deployment-docs-mapping-design.md docs/superpowers/plans/2026-05-30-deployment-docs-mapping.md
git -C 'C:\Users\tanda\Downloads\fitme-sportswear' commit -m "docs: add NestJS deployment and flow mapping guides"
```

---

## Self-review

- Spec coverage: Task 1 creates the NestJS deployment guide, Task 2 creates the business flow mapping guide, Task 3 verifies both files and confirms the legacy HTML still exists.
- Placeholder scan: this plan contains no unfinished markers or undefined implementation steps.
- Scope check: the plan only writes documentation and does not implement real business sync or modify the legacy HTML document.
