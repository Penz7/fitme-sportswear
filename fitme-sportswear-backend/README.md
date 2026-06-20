# FitMe Sportswear Backend

Backend đồng bộ dữ liệu vận hành giữa **Sapo**, **Pancake** và **Shopify** cho hệ thống FitMe Sportswear.

Service này là backend mới, tập trung vào các luồng đồng bộ sản phẩm, tồn kho, đơn hàng, địa chỉ, webhook và job nền. Source `sportswear-main/` trong repo chỉ dùng để đối chiếu nghiệp vụ, không phải module triển khai của backend này.

## Mục lục

- [Tổng quan hệ thống](#tổng-quan-hệ-thống)
- [Kiến trúc module](#kiến-trúc-module)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Cấu hình biến môi trường](#cấu-hình-biến-môi-trường)
- [Chạy local](#chạy-local)
- [Triển khai bằng Docker Compose](#triển-khai-bằng-docker-compose)
- [Database và migration](#database-và-migration)
- [API vận hành](#api-vận-hành)
- [Webhook endpoints](#webhook-endpoints)
- [Scheduler và worker](#scheduler-và-worker)
- [Kiểm thử và build](#kiểm-thử-và-build)
- [Checklist triển khai production](#checklist-triển-khai-production)
- [Lưu ý audit tích hợp](#lưu-ý-audit-tích-hợp)

## Tổng quan hệ thống

```text
                ┌──────────────┐
                │    Sapo      │
                └──────┬───────┘
                       │
                       │ REST/API sync
                       │
┌──────────────┐  ┌─────▼──────────────────────────┐  ┌──────────────┐
│   Shopify    │◄─┤ FitMe Sportswear Backend       ├─►│   Pancake    │
└──────┬───────┘  │ NestJS API + Worker + Prisma   │  └──────┬───────┘
       │          └─────┬──────────────────────────┘         │
       │ webhooks       │                                    │
       │                │ jobs / queues                       │
       │          ┌─────▼─────┐      ┌──────────────┐        │
       └─────────►│  Redis    │      │ PostgreSQL   │◄───────┘
                  └───────────┘      └──────────────┘
```

Backend gồm 2 process chính:

- **API process**: nhận HTTP request, trigger sync thủ công, nhận webhook.
- **Worker process**: xử lý job nền qua Redis/BullMQ, chạy các luồng đồng bộ dài hoặc bất đồng bộ.

Dữ liệu bền vững được lưu bằng **PostgreSQL** thông qua **Prisma**.

## Kiến trúc module

Source chính nằm trong `src/modules`:

| Module | Vai trò |
| --- | --- |
| `config` | Load và validate cấu hình runtime. |
| `database` | Prisma service và kết nối database. |
| `queue` | BullMQ queue, producer, processor constants. |
| `health` | Liveness/readiness endpoints. |
| `sapo` | Client/session logic cho Sapo. |
| `pancake` | Client tích hợp Pancake. |
| `shopify` | Client tích hợp Shopify. |
| `products` | Snapshot, matching, inventory sync, orchestrator đồng bộ sản phẩm. |
| `orders` | Mapping trạng thái, xử lý order webhook, đồng bộ đơn Sapo → Pancake. |
| `address` | Đồng bộ/mapping địa chỉ. |
| `sync` | API trigger sync và scheduler. |
| `webhook` | Nhận Pancake/Shopify webhook, verify Shopify HMAC. |
| `notifications` | Gửi thông báo vận hành, ví dụ Telegram. |

## Yêu cầu môi trường

- Node.js 22+
- npm
- PostgreSQL 16+
- Redis 7+
- Docker và Docker Compose nếu triển khai bằng container

## Cấu hình biến môi trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Nhóm biến chính:

### App

| Biến | Ý nghĩa |
| --- | --- |
| `APP_ENV` | Môi trường chạy, ví dụ `local`, `staging`, `production`. |
| `APP_PORT` | Port HTTP API. Mặc định local là `3000`. |
| `APP_VERSION` | Version hiển thị qua public config. |

### Infrastructure

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string cho Prisma. |
| `REDIS_HOST` | Redis host. |
| `REDIS_PORT` | Redis port. |

### Sapo

| Biến | Ý nghĩa |
| --- | --- |
| `SAPO_BASE_URL` | Base URL gọi API Sapo Go, ví dụ `https://fitme-sportswear.mysapogo.com`. |
| `SAPO_ACCOUNT_BASE_URL` | Base URL account/auth Sapo. |
| `SAPO_PHONE_NUMBER` | Tài khoản đăng nhập Sapo Go/session. |
| `SAPO_PASSWORD` | Mật khẩu đăng nhập Sapo Go/session. |
| `SAPO_CLIENT_ID` | Client ID tích hợp Sapo. |
| `SAPO_SHOP_DOMAIN` | Domain shop Sapo. |
| `SAPO_LOCATION_ID` | Location mặc định để xử lý tồn kho/đơn hàng. |
| `SAPO_LOGIN_COOLDOWN_MS` | Thời gian tạm dừng login lại khi Sapo Accounts trả `403/429`, mặc định 30 phút để tránh spam login và bị block IP. |
| `SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID` | JSON map từ Pancake warehouse ID sang Sapo location ID. |
| `SAPO_PREPAYMENT_METHOD_ID` | Payment method ID dùng khi ghi nhận Pancake prepaid sang Sapo. |
| `SAPO_PREPAYMENT_METHOD_NAME` | Tên payment method dùng khi ghi nhận Pancake prepaid sang Sapo. |

Ví dụ mapping kho:

```env
SAPO_LOCATION_ID=572310
SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID={"pancake-warehouse-1":"572310","pancake-warehouse-2":"999999"}
```

### Pancake

| Biến | Ý nghĩa |
| --- | --- |
| `PANCAKE_BASE_URL` | Base URL Pancake API. |
| `PANCAKE_API_KEY` | API key/token Pancake. |
| `PANCAKE_SHOP_ID` | Shop/page ID Pancake. |
| `PANCAKE_WEBHOOK_SECRET` | Shared secret bắt buộc cho Pancake webhook (`x-pancake-webhook-secret`). |
| `PANCAKE_DEFAULT_WAREHOUSE_ID` | Warehouse fallback khi Pancake create/mapping không trả warehouse ID. |

### Shopify

| Biến | Ý nghĩa |
| --- | --- |
| `SHOPIFY_BASE_URL` | Base URL Shopify shop/admin API. |
| `SHOPIFY_ACCESS_TOKEN` | Admin access token. |
| `SHOPIFY_API_VERSION` | Shopify API version. |
| `SHOPIFY_LOCATION_ID` | Location ID dùng cho tồn kho. |
| `SHOPIFY_WEBHOOK_SECRET` | Secret để verify `x-shopify-hmac-sha256`. |

### Scheduler flags

| Biến | Ý nghĩa |
| --- | --- |
| `SYNC_SCHEDULER_ENABLED` | Bật/tắt scheduler tự động. |
| `SYNC_STARTUP_PRODUCT_SYNC_ENABLED` | Có chạy product sync khi startup không. |
| `SYNC_PRODUCT_CRON` | Cron đồng bộ sản phẩm. |
| `SYNC_ADDRESS_MAPPING_CRON` | Cron đồng bộ mapping địa chỉ. |
| `SYNC_SAPO_TO_PANCAKE_ORDER_CRON` | Cron đồng bộ đơn Sapo → Pancake. |
| `SYNC_SAPO_TO_PANCAKE_ORDER_STATUS` | Trạng thái Sapo order được lấy để sync. |
| `SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT` | Số lượng order mỗi batch. |
| `SYNC_SAPO_TOP_ORDER_CRON` | Cron lấy top Sapo orders. |
| `SYNC_SAPO_TOP_ORDER_LIMIT` | Số lượng top orders mỗi batch. |
| `SYNC_SAPO_LOG_CRON` | Cron đồng bộ log Sapo. |
| `SYNC_CREATE_MISSING_PANCAKE_PRODUCTS` | Cho phép tạo product thiếu trên Pancake. |
| `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS` | Cho phép tạo product thiếu trên Shopify. |
| `SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER` | Flag legacy; backend hiện không ghi Pancake stock từ order quantity vì không an toàn. |
| `SYNC_ADDRESS_ENABLED` | Bật/tắt address mapping sync. |
| `SYNC_ADDRESS_MIN_PROVINCES` | Số province match tối thiểu trước khi cho phép replace mapping. |
| `SYNC_ADDRESS_MIN_DISTRICTS` | Số district match tối thiểu trước khi cho phép replace mapping. |
| `SYNC_ADDRESS_MIN_WARDS` | Số ward match tối thiểu trước khi cho phép replace mapping. |
| `SYNC_ADDRESS_MAX_DISTANCE` | Ngưỡng distance tối đa để nhận match địa chỉ; thấp hơn nghĩa là match chặt hơn. |

## Chạy local

Cài dependencies:

```bash
npm install
```

Khởi động PostgreSQL và Redis local bằng Docker Compose:

```bash
docker compose up -d postgres redis
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Chạy migration cho môi trường local:

```bash
npm run prisma:migrate
```

Chạy API ở watch mode:

```bash
npm run start:dev
```

Chạy worker ở terminal khác:

```bash
npm run worker:dev
```

Kiểm tra health:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/readiness
```

## Triển khai bằng Docker Compose

Chuẩn bị `.env` production/staging phù hợp:

```bash
cp .env.example .env
```

Build và chạy toàn bộ stack:

```bash
docker compose up -d --build
```

Compose hiện có các service:

- `postgres`: PostgreSQL 16, expose host port `5433`.
- `redis`: Redis 7, expose host port `6380`.
- `api`: NestJS API, expose host port `3000`.
- `worker`: NestJS application context để xử lý background jobs.

API và worker đều chạy migration deploy trước khi start:

```bash
npm run prisma:deploy
```

Xem logs:

```bash
docker compose logs -f api
docker compose logs -f worker
```

Restart riêng API hoặc worker:

```bash
docker compose restart api
docker compose restart worker
```

Dừng stack:

```bash
docker compose down
```

Nếu cần xóa cả database volume local:

```bash
docker compose down -v
```

Chỉ dùng `down -v` khi chắc chắn muốn xóa dữ liệu local.

## Database và migration

Prisma schema nằm tại:

```text
prisma/schema.prisma
```

Các command chính:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
```

Quy ước dùng command:

- Local development: `npm run prisma:migrate`
- Deploy/staging/production: `npm run prisma:deploy`
- Sau khi đổi schema: chạy `npm run prisma:generate`

Các nhóm bảng chính:

- `sync_runs`: trạng thái các job sync.
- `webhook_events`: webhook đã nhận.
- `idempotency_keys`: chống xử lý trùng.
- `external_mappings`: mapping ID giữa platform.
- `sapo_products`, `pancake_products`, `shopify_products`: snapshot sản phẩm theo platform.
- `product_mappings`: mapping SKU/product/variant giữa các platform.
- `order_mappings`: mapping order/status giữa Sapo, Pancake, Shopify.
- `province_mapping`, `district_mapping`, `ward_mapping`: mapping địa chỉ.

## API vận hành

Base URL local:

```text
http://localhost:3000
```

### Health

| Method | Path | Mục đích |
| --- | --- | --- |
| `GET` | `/health` | Liveness check. |
| `GET` | `/health/readiness` | Readiness check. |

### Public config

| Method | Path | Mục đích |
| --- | --- | --- |
| `GET` | `/config/public` | Trả environment, version, queue name và platform list. |

### Sync triggers

| Method | Path | Mục đích |
| --- | --- | --- |
| `POST` | `/sync/test` | Tạo test sync job. |
| `GET` | `/sync/test/:id` | Xem test sync run. |
| `POST` | `/sync/products` | Trigger đồng bộ sản phẩm. |
| `GET` | `/sync/products/:id` | Xem product sync run. |
| `POST` | `/sync/address-mappings` | Trigger đồng bộ mapping địa chỉ. |
| `GET` | `/sync/address-mappings/:id` | Xem address mapping sync run. |
| `POST` | `/sync/sapo-to-pancake-orders` | Trigger sync một Sapo order sang Pancake. |
| `POST` | `/sync/sapo-to-pancake-orders/bulk` | Trigger sync nhiều Sapo orders sang Pancake. |
| `POST` | `/sync/sapo-to-pancake-orders/top-orders` | Trigger sync top Sapo orders. |
| `GET` | `/sync/sapo-to-pancake-orders/:id` | Xem Sapo → Pancake order sync run. |
| `POST` | `/sync/sapo-logs` | Trigger đồng bộ Sapo logs. |
| `POST` | `/sync/shopify-product-cleanup` | Trigger cleanup sản phẩm Shopify. |

Các endpoint `/sync/*` được bảo vệ bằng token vận hành. Gửi một trong hai header:

```text
Authorization: Bearer <SYNC_API_TOKEN>
x-sync-api-token: <SYNC_API_TOKEN>
```

Ví dụ trigger product sync:

```bash
curl -X POST http://localhost:3000/sync/products \
  -H "Authorization: Bearer $SYNC_API_TOKEN"
```

Ví dụ trigger một order Sapo → Pancake:

```bash
curl -X POST http://localhost:3000/sync/sapo-to-pancake-orders \
  -H "Authorization: Bearer $SYNC_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"sapoOrderId":"123456"}'
```

## Webhook endpoints

| Method | Path | Mục đích |
| --- | --- | --- |
| `GET` | `/webhooks/internal/status` | Kiểm tra webhook ingestion đã sẵn sàng. |
| `POST` | `/webhook` | Legacy Pancake webhook endpoint. |
| `POST` | `/webhooks/pancake/v1` | Pancake webhook endpoint mới. |
| `POST` | `/webhooks/order` | Legacy Shopify order webhook. |
| `POST` | `/webhooks/product` | Legacy Shopify product webhook. |
| `POST` | `/webhooks/fulfillment` | Legacy Shopify fulfillment webhook. |
| `POST` | `/webhooks/shopify/order` | Shopify order webhook mới. |
| `POST` | `/webhooks/shopify/product` | Shopify product webhook mới. |
| `POST` | `/webhooks/shopify/fulfillment` | Shopify fulfillment webhook mới. |

Pancake webhook bắt buộc gửi shared secret:

```text
x-pancake-webhook-secret: <PANCAKE_WEBHOOK_SECRET>
```

Shopify webhook bắt buộc verify header:

```text
x-shopify-hmac-sha256
```

Secret dùng biến:

```text
SHOPIFY_WEBHOOK_SECRET
```

Có thể tắt side effect webhook mà vẫn trả response ổn định cho provider bằng các kill switch:

```env
WEBHOOK_INGESTION_ENABLED=false
PANCAKE_WEBHOOK_ENABLED=false
SHOPIFY_WEBHOOK_ENABLED=false
```

Khi test riêng Shopify + Sapo, tắt Pancake channel:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=false
SHOPIFY_WEBHOOK_ENABLED=true
SHOPIFY_TEST_ORDER_FILTER=WEBHOOK_TEST
```

Khi `SHOPIFY_TEST_ORDER_FILTER` được set, Shopify order webhook chỉ xử lý đơn
có marker trong `note`, `tags` hoặc `note_attributes`; đơn khác sẽ được nhận
webhook nhưng ignore trước khi tạo/cập nhật Sapo.

Khi test riêng Pancake + Sapo, tắt Shopify channel:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=false
```

Khi vận hành cả hai kênh, bật cả `PANCAKE_WEBHOOK_ENABLED` và
`SHOPIFY_WEBHOOK_ENABLED`. Processor sẽ tách theo `sourcePlatform` và mapping
đơn hàng để tránh đẩy nhầm đơn giữa Pancake và Shopify.

Lưu ý hiện tại: Shopify order webhook được xử lý vào luồng order/fulfillment. Shopify product và fulfillment webhook đã có endpoint nhận/verify nhưng đang được ignore có chủ đích; đồng bộ sản phẩm hiện chạy qua manual trigger hoặc scheduler, chưa chạy trực tiếp theo product webhook để tránh tạo queue storm khi Shopify gửi nhiều webhook liên tiếp.

## Scheduler và worker

Scheduler được điều khiển bằng biến `SYNC_SCHEDULER_ENABLED`.

Worker dùng Redis lock theo từng sync type (`lock:sync:<syncType>`) để tránh chạy chồng cùng một job, đồng thời cho phép các job khác loại chạy song song hơn so với cơ chế global concurrency `1`.

Khuyến nghị triển khai:

- API và worker chạy thành 2 process/container riêng.
- Chỉ bật scheduler ở môi trường được chỉ định rõ.
- Không bật các flag có side effect tạo/cập nhật dữ liệu thật nếu chưa audit kỹ:
  - `SYNC_CREATE_MISSING_PANCAKE_PRODUCTS`
  - `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS`
  - `SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER`

## Kiểm thử và build

Lint:

```bash
npm run lint
```

Unit test:

```bash
npm test
```

E2E test:

```bash
npm run test:e2e
```

Build production:

```bash
npm run build
```

Chạy compiled API:

```bash
npm run start
```

Chạy compiled worker:

```bash
npm run worker
```

Checklist trước khi merge/deploy:

```bash
npm run lint
npm test
npm run build
```

## Checklist triển khai production

1. Chuẩn bị `.env` production đầy đủ.
2. Kiểm tra `DATABASE_URL` trỏ đúng database production.
3. Kiểm tra Redis host/port và network giữa API/worker.
4. Chạy migration deploy:

   ```bash
   npm run prisma:deploy
   ```

5. Start API và worker.
6. Kiểm tra health:

   ```bash
   curl https://<domain>/health
   curl https://<domain>/health/readiness
   ```

7. Kiểm tra public config:

   ```bash
   curl https://<domain>/config/public
   ```

8. Cấu hình webhook URLs trên Shopify/Pancake theo endpoint production.
9. Gửi thử webhook test hoặc trigger sync nhỏ có kiểm soát.
10. Theo dõi logs API/worker và trạng thái `sync_runs`.
11. Chỉ bật scheduler sau khi manual trigger đã chạy đúng.
12. Chỉ bật các flag tạo/cập nhật dữ liệu thật sau khi audit luồng và backup dữ liệu liên quan.

## Lưu ý audit tích hợp

Khi sửa hoặc triển khai các luồng tích hợp, cần audit theo tài liệu chính thức và source đối chiếu:

- **Sapo**: Admin REST dùng `X-Sapo-Access-Token`, có rate limit leaky bucket và lỗi `401/403/404/422/429/5xx` cần xử lý đúng.
- **Shopify**: Admin API cần check cả HTTP status và body `errors`; webhook phải verify HMAC bằng raw body.
- **Pancake**: Public docs hiện chủ yếu cover page/conversation/customer/webhook dạng social/CRM; nếu xử lý commerce order/product/inventory cần đối chiếu thêm source cũ hoặc tài liệu nội bộ trước khi thay đổi.

Không chỉnh `sportswear-main/` trong quá trình phát triển backend mới nếu không có yêu cầu rõ ràng. Module đó chỉ dùng để đọc và đối chiếu nghiệp vụ.
