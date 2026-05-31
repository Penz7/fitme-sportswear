# Huong Dan Lay API/Credential Va Kiem Tra Live Integration

Tai lieu nay dung cho `fitme-sportswear-backend`. Khong commit gia tri that cua token, mat khau, API key hoac webhook secret vao git.

## 1. File cau hinh can tao

Tao file:

```text
fitme-sportswear-backend/.env
```

Mau toi thieu:

```env
APP_ENV=local
APP_PORT=3000
APP_VERSION=0.1.0

DATABASE_URL=postgresql://fitme:fitme@localhost:5433/fitme_sportswear_backend?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380

SAPO_BASE_URL=https://<ten-shop>.mysapogo.com
SAPO_ACCOUNT_BASE_URL=https://accounts.sapo.vn
SAPO_PHONE_NUMBER=<so-dien-thoai-dang-nhap-sapo>
SAPO_PASSWORD=<mat-khau-sapo>
SAPO_CLIENT_ID=<client-id-sapo-pos>
SAPO_SHOP_DOMAIN=<ten-shop>.mysapogo.com
SAPO_LOCATION_ID=<id-chi-nhanh-kho-sapo>

PANCAKE_BASE_URL=https://pos.pages.fm
PANCAKE_API_KEY=<api-key-pancake>
PANCAKE_SHOP_ID=<shop-id-pancake>

SHOPIFY_BASE_URL=https://<shop>.myshopify.com/admin/api/2024-04
SHOPIFY_ACCESS_TOKEN=<admin-api-access-token>
SHOPIFY_API_VERSION=2024-04
SHOPIFY_LOCATION_ID=<location-id-shopify>
SHOPIFY_WEBHOOK_SECRET=<webhook-signing-secret>

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

SHIPPING_SENDER_PROVINCE_ID=2
SHIPPING_SENDER_DISTRICT_ID=55
SHIPPING_PACKAGE_WEIGHT=300
SHIPPING_PACKAGE_HEIGHT=10
SHIPPING_PACKAGE_WIDTH=10
SHIPPING_PACKAGE_LENGTH=10
VIETTELPOST_SERVICE=VSL7
VIETTELPOST_ACCOUNT_ID=604003_1
VIETTELPOST_PROVIDER_ID=508146
VIETTELPOST_INVENTORY_ID=22207987
VIETTELPOST_TRACKING_COMPANY=Viettel

SYNC_SCHEDULER_ENABLED=false
SYNC_STARTUP_PRODUCT_SYNC_ENABLED=false
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=true
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false
```

Khi chay bang Docker Compose, service `api` va `worker` se override:

```env
DATABASE_URL=postgresql://fitme:fitme@postgres:5432/fitme_sportswear_backend?schema=public
REDIS_HOST=redis
REDIS_PORT=6379
```

## 2. Sapo

### Can lay nhung gia tri nao

| Bien | Lay o dau | Ghi chu |
| --- | --- | --- |
| `SAPO_BASE_URL` | URL admin shop Sapo | Vi du `https://fitme-sportswear.mysapogo.com` |
| `SAPO_ACCOUNT_BASE_URL` | Mac dinh | Giu `https://accounts.sapo.vn` |
| `SAPO_PHONE_NUMBER` | Tai khoan dang nhap Sapo | Can quyen du de doc/sua san pham, don, khach, van chuyen |
| `SAPO_PASSWORD` | Mat khau tai khoan Sapo | Nen dung tai khoan rieng cho he thong |
| `SAPO_CLIENT_ID` | Lay tu request dang nhap Sapo POS hien tai hoac cau hinh app Sapo | Backend dung login flow giong Java cu |
| `SAPO_SHOP_DOMAIN` | Domain shop Sapo | Vi du `fitme-sportswear.mysapogo.com` |
| `SAPO_LOCATION_ID` | ID chi nhanh/kho trong Sapo | Dung trong header `X-Sapo-LocationId` |

### API backend se goi

Backend tu dong login Sapo bang session cookie, sau do goi:

```text
GET  /admin/products/search.json
GET  /admin/orders.json
GET  /admin/orders/{id}.json
GET  /admin/logs.json
GET  /admin/customers.json
POST /admin/customers.json
POST /admin/orders.json
PUT  /admin/orders/{id}.json
POST /admin/orders/{id}/finalize.json
POST /admin/orders/{id}/prepayments.json
POST /admin/orders/{id}/fulfillments.json
POST /admin/orders/{id}/fulfillments/{fulfillmentId}/ship.json
POST /admin/orders/{id}/fulfillments/{fulfillmentId}/cancel.json
POST /admin/orders/{id}/fulfillments/{fulfillmentId}/receive_after_cancellation.json
POST /admin/orders/{id}/cancel.json
GET  /admin/shipping_services/v3/vtp/price.json
GET  /admin/cities.json
GET  /admin/countries/201/cities/{cityId}/districts.json
GET  /admin/districts/{districtId}/wards.json
```

### Cach kiem tra nhanh

Sau khi dien `.env`, chay app va goi:

```powershell
curl http://localhost:3000/health/readiness
curl -X POST http://localhost:3000/sync/products
curl -X POST http://localhost:3000/sync/sapo-logs
curl -X POST http://localhost:3000/sync/sapo-to-pancake-orders/top-orders
```

Neu sync fail, xem bang `sync_runs.errorMessage` trong PostgreSQL.

## 3. Pancake

### Can lay nhung gia tri nao

| Bien | Lay o dau | Ghi chu |
| --- | --- | --- |
| `PANCAKE_BASE_URL` | Base URL Pancake POS API | Nen de `https://pos.pages.fm` neu API tra ve dung path `/api/v1/...` |
| `PANCAKE_API_KEY` | Pancake POS settings/API integration | Key duoc gan vao query string `api_key` |
| `PANCAKE_SHOP_ID` | ID shop/page trong Pancake | Xuat hien trong URL/API path `/shops/{shopId}` |

### API backend se goi

```text
GET  /api/v1/shops/{shopId}/products/variations
POST /api/v1/shops/{shopId}/variations/{variantId}/update_quantity
POST /api/v1/shops/{shopId}/products
GET  /api/v1/shops/{shopId}/orders
GET  /api/v1/shops/{shopId}/orders/{orderId}
POST /api/v1/shops/{shopId}/orders
PUT  /api/v1/shops/{shopId}/orders/{orderId}
GET  /geo/provinces
GET  /geo/districts
GET  /geo/communes
```

### Webhook Pancake can cau hinh

Trong Pancake, cau hinh webhook URL ve backend:

```text
http://<server>:3000/webhooks/pancake/v1
```

Backend van ho tro route legacy:

```text
http://<server>:3000/webhook
```

Can bat cac event don hang:

```text
orders create
orders update
```

### Cach kiem tra nhanh

```powershell
curl -X POST http://localhost:3000/sync/address-mappings
curl -X POST http://localhost:3000/sync/products
```

Voi webhook, dung payload mau tu Pancake hoac payload that gui tu Pancake. Backend se luu vao `webhook_events` va enqueue job qua Redis.

## 4. Shopify

### Can lay nhung gia tri nao

| Bien | Lay o dau | Ghi chu |
| --- | --- | --- |
| `SHOPIFY_BASE_URL` | Shopify Admin API URL | Dang `https://<shop>.myshopify.com/admin/api/2024-04` |
| `SHOPIFY_ACCESS_TOKEN` | Custom app Admin API access token | Can scopes san pham, ton kho, don hang, fulfillment |
| `SHOPIFY_API_VERSION` | Shopify API version | Dang code dang dung `2024-04` |
| `SHOPIFY_LOCATION_ID` | Shopify Admin location ID | Neu bo trong, backend se lay location dau tien qua API |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret | Dung de verify `x-shopify-hmac-sha256` |

### Scopes nen cap cho custom app

Toi thieu can cac quyen tuong ung:

```text
read_products
write_products
read_inventory
write_inventory
read_locations
read_orders
write_orders
read_fulfillments
write_fulfillments
```

Neu shopify app UI yeu cau scope moi cho fulfillment order, cap them quyen fulfillment/order tuong ung.

### API backend se goi

```text
GET    /products.json
POST   /products.json
GET    /products/{productId}.json
DELETE /products/{productId}.json
GET    /variants/{variantId}.json
PUT    /variants/{variantId}.json
GET    /locations.json
POST   /inventory_levels/set.json
POST   /orders/{orderId}/cancel.json
POST   /orders/{orderId}/fulfillments.json
```

### Webhook Shopify can cau hinh

Tao webhook trong Shopify Admin hoac custom app:

```text
Order webhook:
http://<server>:3000/webhooks/shopify/order

Product webhook:
http://<server>:3000/webhooks/shopify/product

Fulfillment webhook:
http://<server>:3000/webhooks/shopify/fulfillment
```

Backend van ho tro legacy routes:

```text
http://<server>:3000/webhooks/order
http://<server>:3000/webhooks/product
http://<server>:3000/webhooks/fulfillment
```

Webhook request phai co header:

```text
x-shopify-hmac-sha256
```

Gia tri nay duoc backend verify bang `SHOPIFY_WEBHOOK_SECRET`.

## 5. Telegram

Telegram la optional. Neu khong dien, backend bo qua gui thong bao loi.

| Bien | Lay o dau |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Tao bot bang BotFather |
| `TELEGRAM_CHAT_ID` | Chat/group ID nhan thong bao |

## 6. ViettelPost/Sapo shipping

Cac bien nay hien co default trong code, nhung truoc khi chay that can xac nhan lai voi Sapo/ViettelPost cua shop:

```env
SHIPPING_SENDER_PROVINCE_ID=2
SHIPPING_SENDER_DISTRICT_ID=55
VIETTELPOST_SERVICE=VSL7
VIETTELPOST_ACCOUNT_ID=604003_1
VIETTELPOST_PROVIDER_ID=508146
VIETTELPOST_INVENTORY_ID=22207987
VIETTELPOST_TRACKING_COMPANY=Viettel
```

Dung khi backend tao fulfillment Sapo va day qua hang van chuyen.

## 7. Cac endpoint noi bo de test

Chay API o port 3000:

```powershell
npm run start:dev
```

Chay worker:

```powershell
npm run worker:dev
```

Hoac chay bang Docker Compose:

```powershell
docker compose up --build
```

Endpoint:

```text
GET  /health
GET  /health/readiness
GET  /config/public
GET  /webhooks/internal/status

POST /sync/products
GET  /sync/products/{syncRunId}

POST /sync/address-mappings
GET  /sync/address-mappings/{syncRunId}

POST /sync/sapo-to-pancake-orders
POST /sync/sapo-to-pancake-orders/bulk
POST /sync/sapo-to-pancake-orders/top-orders
GET  /sync/sapo-to-pancake-orders/{syncRunId}

POST /sync/sapo-logs
POST /sync/shopify-product-cleanup
```

Body cho sync mot don Sapo:

```json
{
  "sapoOrderId": "123456789"
}
```

Body cho bulk Sapo -> Pancake:

```json
{
  "status": "finalized",
  "limit": 25
}
```

## 8. Thu tu test live de giam rui ro

1. Chay `npm run prisma:deploy` va `npm run prisma:generate`.
2. Chay `npm test -- --runInBand`.
3. Chay `npm run build`.
4. Chay API va worker.
5. Goi `GET /health/readiness`.
6. Goi `POST /sync/address-mappings`.
7. Goi `POST /sync/products` voi 1 tap SKU nho.
8. Kiem tra `product_mappings` va cac bang `sapo_products`, `pancake_products`, `shopify_products`.
9. Goi `POST /sync/sapo-to-pancake-orders` voi 1 don Sapo test.
10. Tao 1 webhook Pancake test va kiem tra `webhook_events`, `order_mappings`, `sync_runs`.
11. Tao 1 webhook Shopify test va kiem tra HMAC, Sapo order, Shopify fulfillment.
12. Chi bat scheduler sau khi cac buoc tren da dung.

## 9. Scheduler

Chi bat sau khi live test tung flow thanh cong:

```env
SYNC_SCHEDULER_ENABLED=true
SYNC_PRODUCT_CRON=*/15 * * * *
SYNC_ADDRESS_MAPPING_CRON=0 2 * * *
SYNC_SAPO_TO_PANCAKE_ORDER_CRON=*/5 * * * *
SYNC_SAPO_TO_PANCAKE_ORDER_STATUS=finalized
SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT=25
SYNC_SAPO_TOP_ORDER_CRON=*/10 * * * *
SYNC_SAPO_TOP_ORDER_LIMIT=50
SYNC_SAPO_LOG_CRON=*/1 * * * *
```

Khuyen nghi ban dau:

```env
SYNC_SCHEDULER_ENABLED=false
SYNC_STARTUP_PRODUCT_SYNC_ENABLED=false
SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false
```

Bat tung bien mot sau khi da co du lieu test an toan.

## 10. Dau hieu thanh cong

- `GET /health/readiness` tra ve ready.
- `sync_runs.status` la `succeeded`.
- `webhook_events.status` chuyen tu `queued` sang `succeeded` sau khi worker xu ly.
- `idempotency_keys` co ban ghi khi webhook/log duoc xu ly, goi lai khong xu ly trung.
- Sapo la source of truth cho ton kho product sync.
- Pancake va Shopify cap nhat dung SKU, dung variant, dung warehouse/location.
- Don test tao/cap nhat/huy dung mapping trang thai.
