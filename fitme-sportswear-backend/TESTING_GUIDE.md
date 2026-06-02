# Hướng dẫn test từng phần hệ thống FitMe Sportswear Backend

Tài liệu này hướng dẫn test backend mới theo từng cấp độ để xác nhận luồng **Sapo ↔ Pancake ↔ Shopify** chạy đúng, đồng thời hạn chế tối đa ảnh hưởng tới dữ liệu production.

> Nguyên tắc chính: test từ bước không có side effect trước, sau đó mới test các bước đọc dữ liệu, cuối cùng mới test các bước có ghi dữ liệu lên Sapo/Pancake/Shopify. Không bật scheduler hoặc webhook trước khi manual test ổn.

## 1. Phạm vi test

Backend mới gồm các nhóm chức năng chính:

1. Hạ tầng: PostgreSQL, Redis, API, worker.
2. Cấu hình bảo mật: `SYNC_API_TOKEN`, webhook secrets, kill switches.
3. Address mapping Sapo ↔ Pancake.
4. Product snapshot/mapping/inventory.
5. Order sync Sapo → Pancake.
6. Shopify product/order/fulfillment nếu bật.
7. Webhook Pancake/Shopify.
8. Scheduler/background jobs.

Source `sportswear-main/` chỉ dùng làm source đối chiếu nghiệp vụ. Không sửa hoặc chạy thay thế source đó khi test backend mới.

## 2. Cấu hình an toàn trước khi test

Trong lần test đầu tiên, nên tắt toàn bộ automation/side effect tự động:

```env
WEBHOOK_INGESTION_ENABLED=false
PANCAKE_WEBHOOK_ENABLED=false
SHOPIFY_WEBHOOK_ENABLED=false

SYNC_SCHEDULER_ENABLED=false
SYNC_STARTUP_PRODUCT_SYNC_ENABLED=false

SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false
```

Ý nghĩa:

| Biến | Lý do tắt khi test đầu |
| --- | --- |
| `WEBHOOK_INGESTION_ENABLED=false` | Không xử lý webhook thật từ provider. |
| `PANCAKE_WEBHOOK_ENABLED=false` | Không xử lý webhook Pancake. |
| `SHOPIFY_WEBHOOK_ENABLED=false` | Không xử lý webhook Shopify. |
| `SYNC_SCHEDULER_ENABLED=false` | Không tự chạy cron/job định kỳ. |
| `SYNC_STARTUP_PRODUCT_SYNC_ENABLED=false` | Không tự sync product khi app start. |
| `SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false` | Không tự tạo sản phẩm lên Pancake. |
| `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false` | Không tự tạo sản phẩm lên Shopify. |
| `SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false` | Không cập nhật tồn Pancake từ order quantity. |

Cần có token manual sync:

```env
SYNC_API_TOKEN=<random-token-de-test>
```

Ví dụ local/test:

```env
SYNC_API_TOKEN=fitme-local-sync
```

`SYNC_API_TOKEN` chỉ dùng để bảo vệ endpoint `/sync/*`. Scheduler/worker nội bộ không dùng token này.

## 3. Kiểm tra env bắt buộc

### 3.1. Sapo

Tối thiểu cần xác nhận:

```env
SAPO_BASE_URL=https://fitme-sportswear.mysapogo.com
SAPO_ACCOUNT_BASE_URL=https://accounts.sapo.vn
SAPO_PHONE_NUMBER=<sapo-phone>
SAPO_PASSWORD=<sapo-password>
SAPO_CLIENT_ID=<sapo-client-id>
SAPO_SHOP_DOMAIN=<sapo-shop-domain>
SAPO_LOCATION_ID=572310
SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID={}
SAPO_PREPAYMENT_METHOD_ID=2575663
SAPO_PREPAYMENT_METHOD_NAME=Chuyen khoan
```

Sau khi có Pancake warehouse đúng, cập nhật:

```env
SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID={"<pancake-warehouse-id>":"572310"}
```

### 3.2. Pancake

Tối thiểu cần xác nhận:

```env
PANCAKE_BASE_URL=https://pos.pages.fm/api/v1
PANCAKE_API_KEY=<pancake-api-key>
PANCAKE_SHOP_ID=<shop-id-dung>
PANCAKE_WEBHOOK_SECRET=<random-secret-neu-test-webhook>
PANCAKE_DEFAULT_WAREHOUSE_ID=<warehouse-id-dung>
```

Kiểm tra API key có đúng shop hay không:

```bash
curl "https://pos.pages.fm/api/v1/shops?api_key=<PANCAKE_API_KEY>"
```

Kiểm tra warehouse của shop đúng:

```bash
curl "https://pos.pages.fm/api/v1/shops/<PANCAKE_SHOP_ID>/warehouses?api_key=<PANCAKE_API_KEY>"
```

Chỉ dùng `PANCAKE_SHOP_ID` và `PANCAKE_DEFAULT_WAREHOUSE_ID` khi response đúng shop cần đồng bộ.

### 3.3. Shopify

Nếu chưa test Shopify, có thể tắt:

```env
SHOPIFY_WEBHOOK_ENABLED=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Nếu test Shopify, cấu hình theo source cũ map sang backend mới:

```env
SHOPIFY_BASE_URL=https://<shopify-subdomain>.myshopify.com/admin/api/2024-04
SHOPIFY_ACCESS_TOKEN=<shopify-admin-access-token>
SHOPIFY_API_VERSION=2024-04
SHOPIFY_LOCATION_ID=
SHOPIFY_WEBHOOK_SECRET=<shopify-webhook-secret>
```

`SHOPIFY_LOCATION_ID` có thể để trống để backend lấy location đầu tiên, giống source cũ. Production nhiều kho nên điền rõ.

## 4. Khởi động hệ thống test

Backend mới cần đủ 4 thành phần:

1. PostgreSQL.
2. Redis.
3. API process.
4. Worker process.

### 4.1. Chạy PostgreSQL

Nếu chưa có container:

```bash
docker run -d \
  --name fitme_postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=fitme \
  -e POSTGRES_PASSWORD=fitme \
  -e POSTGRES_DB=fitme_sportswear_backend \
  -p 5433:5432 \
  -v fitme_postgres_data:/var/lib/postgresql/data \
  postgres:16
```

Nếu container đã tồn tại:

```bash
docker start fitme_postgres
```

### 4.2. Chạy Redis

Nếu chưa có container:

```bash
docker run -d \
  --name fitme_redis \
  --restart unless-stopped \
  -p 6380:6379 \
  redis:7
```

Nếu container đã tồn tại:

```bash
docker start fitme_redis
```

### 4.3. Cài dependencies, generate Prisma, migrate

```bash
cd fitme-sportswear-backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

Nếu đang dùng migration deploy cho môi trường giống production:

```bash
npm run prisma:deploy
```

### 4.4. Build và chạy API/worker

```bash
npm run build
nohup npm run start > api.log 2>&1 &
nohup npm run worker > worker.log 2>&1 &
```

Xem log:

```bash
tail -f api.log
tail -f worker.log
```

## 5. Test cấp 1: health và readiness

Mục tiêu: xác nhận API chạy, không test side effect.

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/readiness
curl http://localhost:3000/config/public
```

Kỳ vọng:

- API trả response thành công.
- Readiness không báo lỗi DB/Redis.
- Public config hiển thị environment/version/queue/platforms.

Nếu fail ở bước này, chưa test sync.

## 6. Test cấp 2: bảo vệ `/sync/*` bằng token

Mục tiêu: xác nhận endpoint sync không bị gọi tự do.

Thiếu token phải bị chặn:

```bash
curl -i http://localhost:3000/sync/products/fake-id
```

Kỳ vọng:

```text
401 Unauthorized
```

Có token thì không bị 401:

```bash
curl -i http://localhost:3000/sync/products/fake-id \
  -H "Authorization: Bearer <SYNC_API_TOKEN>"
```

Có thể trả 404/not found vì run ID giả, nhưng không được là 401.

## 7. Test cấp 3: address mapping Sapo ↔ Pancake

Mục tiêu: xác nhận backend đọc địa chỉ từ Sapo/Pancake và ghi mapping vào DB nội bộ.

Chạy:

```bash
curl -X POST http://localhost:3000/sync/address-mappings \
  -H "Authorization: Bearer <SYNC_API_TOKEN>"
```

Response sẽ có sync run/job id. Sau đó check trạng thái:

```bash
curl http://localhost:3000/sync/address-mappings/<syncRunId> \
  -H "Authorization: Bearer <SYNC_API_TOKEN>"
```

Theo dõi worker:

```bash
tail -f worker.log
```

Kỳ vọng:

- Fetch được Sapo cities/districts/wards.
- Fetch được Pancake provinces/districts/communes.
- Không fail do minimum threshold.
- DB có dữ liệu trong các bảng mapping địa chỉ.

Nếu fail bước này, chưa test order sync.

## 8. Test cấp 4: product snapshot/mapping, không tạo product mới

Trước khi chạy, đảm bảo:

```env
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Chạy:

```bash
curl -X POST http://localhost:3000/sync/products \
  -H "Authorization: Bearer <SYNC_API_TOKEN>"
```

Check trạng thái theo sync run id nếu response trả về:

```bash
curl http://localhost:3000/sync/products/<syncRunId> \
  -H "Authorization: Bearer <SYNC_API_TOKEN>"
```

Kỳ vọng:

- Đọc được sản phẩm Sapo.
- Đọc được sản phẩm Pancake.
- Lưu snapshot vào DB.
- Match theo SKU.
- Ghi product mappings.
- Không tự tạo sản phẩm trên Pancake/Shopify.

Kiểm tra DB:

```text
sapo_products
pancake_products
shopify_products
product_mappings
sync_runs
```

Nếu có duplicate SKU/conflict, xử lý trước khi bật các flag tạo/cập nhật.

## 9. Test cấp 5: sync một order Sapo → Pancake có kiểm soát

Đây là bước có thể tạo/cập nhật order trên Pancake. Chỉ chạy khi address/product mapping đã ổn.

Chọn một Sapo order test hoặc order ít rủi ro. Ghi lại ID trước khi chạy.

```bash
curl -X POST http://localhost:3000/sync/sapo-to-pancake-orders \
  -H "Authorization: Bearer <SYNC_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"sapoOrderId":"<SAPO_ORDER_ID_TEST>"}'
```

Kỳ vọng:

- Backend fetch được Sapo order.
- Address được map đúng sang Pancake.
- Items/SKU/quantity đúng.
- Warehouse đúng.
- Payment/prepaid đúng nếu order có thanh toán trước.
- Pancake order được tạo hoặc cập nhật đúng.
- Bảng `order_mappings` có record đúng.

Nếu bước này sai, dừng test side effect, tắt scheduler/webhook và xử lý mapping/env trước.

## 10. Test cấp 6: tạo product thiếu trên Pancake nếu thật sự cần

Chỉ test sau khi product snapshot/mapping ổn.

Bật tạm:

```env
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=true
```

Restart API/worker để nhận env mới:

```bash
pkill -f "npm run start"
pkill -f "npm run worker"
nohup npm run start > api.log 2>&1 &
nohup npm run worker > worker.log 2>&1 &
```

Chạy lại product sync:

```bash
curl -X POST http://localhost:3000/sync/products \
  -H "Authorization: Bearer <SYNC_API_TOKEN>"
```

Kỳ vọng:

- Chỉ tạo các sản phẩm thiếu đúng điều kiện.
- Không tạo trùng SKU.
- Warehouse/price/inventory đúng.

Sau khi test xong, nên tắt lại:

```env
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false
```

## 11. Test Shopify nếu cần

Nếu chưa đưa Shopify vào vận hành, bỏ qua phần này và giữ:

```env
SHOPIFY_WEBHOOK_ENABLED=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Nếu test Shopify, kiểm tra token trước:

```bash
curl "$SHOPIFY_BASE_URL/shop.json" \
  -H "X-Shopify-Access-Token: <SHOPIFY_ACCESS_TOKEN>"
```

Lấy/check locations:

```bash
curl "$SHOPIFY_BASE_URL/locations.json" \
  -H "X-Shopify-Access-Token: <SHOPIFY_ACCESS_TOKEN>"
```

Nếu có nhiều location, điền rõ:

```env
SHOPIFY_LOCATION_ID=<location-id-dung>
```

Product sync với Shopify nên chạy khi:

```env
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Sau khi mapping ổn mới cân nhắc bật tạo Shopify product.

## 12. Test webhook

Chỉ test webhook sau khi manual sync ổn.

### 12.1. Pancake webhook

Bật:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=true
```

Giữ Shopify tắt nếu chưa test:

```env
SHOPIFY_WEBHOOK_ENABLED=false
```

Webhook Pancake phải gửi header:

```text
x-pancake-webhook-secret: <PANCAKE_WEBHOOK_SECRET>
```

Endpoint:

```text
POST /webhooks/pancake/v1
```

Nếu Pancake không hỗ trợ custom header, chưa bật production webhook cho đến khi backend hỗ trợ secret qua query/body.

### 12.2. Shopify webhook

Bật khi đã có webhook secret đúng:

```env
WEBHOOK_INGESTION_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=true
```

Shopify webhook phải verify HMAC header:

```text
x-shopify-hmac-sha256
```

Endpoint mới:

```text
POST /webhooks/shopify/order
POST /webhooks/shopify/product
POST /webhooks/shopify/fulfillment
```

## 13. Test scheduler

Chỉ bật scheduler sau khi manual sync ổn.

Bật:

```env
SYNC_SCHEDULER_ENABLED=true
```

Khuyến nghị cron test ban đầu nên thưa:

```env
SYNC_PRODUCT_CRON=0 */2 * * *
SYNC_ADDRESS_MAPPING_CRON=0 2 * * *
SYNC_SAPO_TO_PANCAKE_ORDER_CRON=*/30 * * * *
SYNC_SAPO_TOP_ORDER_CRON=*/30 * * * *
SYNC_SAPO_LOG_CRON=*/15 * * * *
```

Theo dõi:

```bash
tail -f api.log
tail -f worker.log
```

Kỳ vọng:

- Scheduler enqueue job đúng cron.
- Worker xử lý job.
- Redis lock chặn job cùng loại chạy chồng.
- Không có job lặp vô hạn do lỗi mapping/env.

## 14. Rollback nhanh nếu có bất thường

Nếu webhook gây side effect:

```env
WEBHOOK_INGESTION_ENABLED=false
PANCAKE_WEBHOOK_ENABLED=false
SHOPIFY_WEBHOOK_ENABLED=false
```

Nếu scheduler chạy sai:

```env
SYNC_SCHEDULER_ENABLED=false
```

Nếu product creation/inventory sai:

```env
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false
```

Restart API/worker:

```bash
pkill -f "npm run start"
pkill -f "npm run worker"
nohup npm run start > api.log 2>&1 &
nohup npm run worker > worker.log 2>&1 &
```

## 15. Checklist xác nhận trước khi xem là ổn

### Hạ tầng

- [ ] PostgreSQL chạy.
- [ ] Redis chạy.
- [ ] API chạy.
- [ ] Worker chạy.
- [ ] `/health` pass.
- [ ] `/health/readiness` pass.

### Env

- [ ] Sapo login/session env đúng.
- [ ] Sapo base/account URL đúng.
- [ ] Sapo location/payment ID đã xác minh.
- [ ] Pancake API key đúng shop.
- [ ] Pancake shop ID đúng.
- [ ] Pancake warehouse ID đúng.
- [ ] Sapo ↔ Pancake warehouse mapping đúng.
- [ ] Shopify env đúng nếu test Shopify.
- [ ] `SYNC_API_TOKEN` đã set.

### Manual sync

- [ ] Address mapping sync pass.
- [ ] Product snapshot sync pass.
- [ ] Product mapping không conflict nghiêm trọng.
- [ ] Một order Sapo → Pancake test pass.
- [ ] Không có dữ liệu tạo sai trên Pancake/Sapo/Shopify.

### Automation

- [ ] Webhook vẫn tắt trong giai đoạn manual test.
- [ ] Scheduler vẫn tắt trong giai đoạn manual test.
- [ ] Chỉ bật scheduler sau khi manual sync ổn.
- [ ] Chỉ bật webhook sau khi secret/header và manual flow ổn.

## 16. Thứ tự test khuyến nghị

```text
1. Health/readiness/public config
2. Sync API token guard
3. Address mapping sync
4. Product sync với create missing = false
5. Kiểm tra DB snapshot/mapping/conflict
6. Sync một Sapo order test sang Pancake
7. Nếu cần, bật create missing Pancake products và test một lần
8. Test Shopify riêng nếu cần
9. Bật scheduler với cron thưa
10. Bật webhook sau cùng
```

Khi chưa qua bước 6 ổn định, không bật scheduler hoặc webhook.
