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
