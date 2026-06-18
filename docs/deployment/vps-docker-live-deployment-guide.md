# Huong Dan Chay Live He Thong Moi Tren VPS Bang Docker

Tai lieu nay dung de dua backend FitMe Sportswear moi len VPS chay live cho luong Sapo, Pancake va Shopify.

Backend gom 4 thanh phan Docker:

- `api`: nhan webhook, health check, API trigger sync.
- `worker`: xu ly queue, scheduler, inventory/order sync.
- `postgres`: database.
- `redis`: queue/lock/cache cho job nen.

## 1. Dieu kien truoc khi deploy

VPS can co:

- Ubuntu 22.04/24.04 hoac Debian tuong duong.
- Domain/subdomain tro ve VPS, vi du `api.fitme.vn`.
- Quyen SSH root hoac user co sudo.
- Port public:
  - `80` va `443` neu dung Nginx + SSL.
  - `3000` chi nen mo tam thoi de test noi bo; live nen di qua Nginx/HTTPS.

Khuyen nghi cau hinh VPS toi thieu:

- CPU: 2 vCPU.
- RAM: 4 GB tro len.
- Disk: 40 GB tro len.

## 2. Cai Docker tren VPS

SSH vao VPS:

```bash
ssh root@<VPS_IP>
```

Cap nhat package:

```bash
apt update && apt upgrade -y
```

Cai Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Bat Docker tu dong khoi dong:

```bash
systemctl enable docker
systemctl start docker
```

Kiem tra:

```bash
docker version
docker compose version
```

## 3. Dua source len VPS

Cai Git neu chua co:

```bash
apt install -y git
```

Clone source:

```bash
mkdir -p /opt/fitme
cd /opt/fitme
git clone <GIT_REPO_URL> fitme-sportswear
cd fitme-sportswear
```

Checkout branch live:

```bash
git checkout main
git pull origin main
```

Thu muc backend:

```bash
cd /opt/fitme/fitme-sportswear/fitme-sportswear-backend
```

## 4. Tao file docker compose production

Tao file `docker-compose.prod.yml` tren VPS:

```bash
nano docker-compose.prod.yml
```

Noi dung de xuat:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: fitme
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: fitme_sportswear_backend
    volumes:
      - fitme_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fitme -d fitme_sportswear_backend"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - fitme_redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: .
    restart: unless-stopped
    command: sh -c "npm run prisma:deploy && node dist/main.js"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://fitme:${POSTGRES_PASSWORD}@postgres:5432/fitme_sportswear_backend?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      QUEUE_PROCESSORS_ENABLED: "false"
      SYNC_SCHEDULER_ENABLED: "false"
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build: .
    restart: unless-stopped
    command: sh -c "npm run prisma:deploy && node dist/worker.js"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://fitme:${POSTGRES_PASSWORD}@postgres:5432/fitme_sportswear_backend?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  fitme_postgres_data:
  fitme_redis_data:
```

Ly do dung file prod rieng:

- Khong expose Postgres/Redis ra internet.
- API chi bind `127.0.0.1:3000`, public traffic di qua Nginx.
- Container tu restart khi VPS reboot.
- Redis co appendonly de giam mat queue metadata khi restart.

## 5. Tao file `.env` live

Trong thu muc backend:

```bash
cp .env.example .env
nano .env
```

Bat buoc dat secret rieng cho VPS:

```env
APP_ENV=production
APP_PORT=3000
APP_VERSION=live

POSTGRES_PASSWORD=<mat-khau-postgres-rat-manh>
SYNC_API_TOKEN=<token-van-hanh-rat-manh>
```

### 5.1. Sapo

Dien theo thong tin live:

```env
SAPO_BASE_URL=<sapo-api-base-url>
SAPO_ACCOUNT_BASE_URL=<sapo-account-base-url>
SAPO_PHONE_NUMBER=<sapo-phone>
SAPO_PASSWORD=<sapo-password>
SAPO_CLIENT_ID=<sapo-client-id>
SAPO_SHOP_DOMAIN=<sapo-shop-domain>
SAPO_LOCATION_ID=<sapo-main-location-id>
SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID={}
SAPO_PREPAYMENT_METHOD_ID=<sapo-payment-method-id>
SAPO_PREPAYMENT_METHOD_NAME=Chuyen khoan
```

Luu y quyen Sapo token/tai khoan can du:

- Tao don.
- Tao/cap nhat customer.
- Huy don.
- Tao/huy/xu ly fulfillment.
- Doc san pham, ton kho, don hang.
- Ghi nhan thanh toan neu dung prepaid.

### 5.2. Pancake

```env
PANCAKE_BASE_URL=https://pos.pages.fm/api/v1
PANCAKE_API_KEY=<pancake-api-key>
PANCAKE_SHOP_ID=<pancake-shop-id>
PANCAKE_DEFAULT_WAREHOUSE_ID=<pancake-default-warehouse-id>
PANCAKE_WEBHOOK_SECRET=<pancake-webhook-secret-rieng-live>
PANCAKE_PRODUCT_REQUEST_TIMEOUT_MS=60000
PANCAKE_PRODUCT_RETRY_ATTEMPTS=3
PANCAKE_PRODUCT_RETRY_BACKOFF_MS=1000
```

Live webhook Pancake se la:

```text
https://<DOMAIN>/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
```

Vi du:

```text
https://api.fitme.vn/webhook?secret=fitme-pancake-live-secret
```

Trong Pancake:

- Bat Webhook URL.
- Data: `Don hang`.
- URL: dung link tren.
- Request headers co the de trong neu da dung query `?secret=...`.

### 5.3. Shopify

```env
SHOPIFY_BASE_URL=https://<shop-name>.myshopify.com/admin/api/2025-07
SHOPIFY_API_VERSION=2025-07
SHOPIFY_ACCESS_TOKEN=<shopify-admin-access-token>
SHOPIFY_LOCATION_ID=<shopify-location-id>
SHOPIFY_WEBHOOK_SECRET=<shopify-webhook-secret>
SHOPIFY_WEBHOOK_PUBLIC_BASE_URL=https://<DOMAIN>
SHOPIFY_WEBHOOK_AUTO_REGISTER_ENABLED=true
SHOPIFY_PRODUCT_FETCH_PAGE_DELAY_MS=750
SHOPIFY_PRODUCT_FETCH_MAX_RETRIES=5
SHOPIFY_PRODUCT_FETCH_RETRY_BASE_DELAY_MS=2000
```

Khi worker start, backend se tu ensure 2 webhook Shopify:

```text
orders/create    -> https://<DOMAIN>/webhooks/shopify/order
orders/cancelled -> https://<DOMAIN>/webhooks/shopify/order
```

Shopify access token can co quyen:

- `read_orders`, `write_orders`
- `read_products`, `write_products`
- `read_inventory`, `write_inventory`
- `read_fulfillments`, `write_fulfillments`
- `read_locations`
- Cac fulfillment scopes lien quan neu shop yeu cau.

### 5.4. Telegram

```env
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<telegram-chat-id>
```

Telegram dung de nhan:

- Webhook/order failed.
- Inventory sync progress.
- Sapo -> Pancake sync.
- Sapo -> Shopify sync.
- Canh bao permission/mapping.

### 5.5. Bat/tat webhook live

Live that:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=true
PANCAKE_TEST_ORDER_FILTER=
SHOPIFY_TEST_ORDER_FILTER=
```

Neu muon test tren VPS truoc khi live:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=true
PANCAKE_TEST_ORDER_FILTER=WEBHOOK_TEST
SHOPIFY_TEST_ORDER_FILTER=WEBHOOK_TEST
```

Khi co filter, chi don co note/tag/marker `WEBHOOK_TEST` moi duoc xu ly.

### 5.6. Scheduler live

Khuyen nghi live ban dau:

```env
SYNC_SCHEDULER_ENABLED=true
SYNC_STARTUP_PRODUCT_SYNC_ENABLED=false
SYNC_PRODUCT_CRON=*/10 * * * *
SYNC_SHOPIFY_PRODUCT_SYNC_ENABLED=true

SYNC_SAPO_TO_PANCAKE_INVENTORY_CRON=*/10 * * * *
SYNC_SAPO_TO_PANCAKE_INVENTORY_CIRCUIT_BREAKER=500
SYNC_SAPO_TO_PANCAKE_INVENTORY_BATCH_SIZE=100
SYNC_SAPO_TO_PANCAKE_INVENTORY_DELAY_MS=50
SYNC_SAPO_TO_PANCAKE_INVENTORY_RETRY_ATTEMPTS=3
SYNC_SAPO_TO_PANCAKE_INVENTORY_MAX_UPDATES_PER_RUN=200
SYNC_SAPO_TO_PANCAKE_INVENTORY_HOT_WINDOW_MINUTES=30

SYNC_SAPO_TO_PANCAKE_ORDER_CRON=*/10 * * * *
SYNC_SAPO_TO_PANCAKE_ORDER_STATUS=finalized
SYNC_SAPO_TO_PANCAKE_ORDER_LIMIT=50
SYNC_SAPO_TOP_ORDER_CRON=*/10 * * * *
SYNC_SAPO_TOP_ORDER_SHOPIFY_CRON=*/10 * * * *
SYNC_SAPO_TOP_ORDER_LIMIT=50
SYNC_SHOPIFY_ORDER_RECONCILE_CRON=*/10 * * * * *
SYNC_SHOPIFY_ORDER_RECONCILE_LIMIT=50
SYNC_SAPO_LOG_CRON=
```

Luu y:

- `SYNC_SHOPIFY_ORDER_RECONCILE_CRON=*/10 * * * * *` la moi 10 giay.
- `SYNC_PRODUCT_CRON=*/10 * * * *` la moi 10 phut.

### 5.7. Tao product/SKU thieu

Khuyen nghi live an toan:

```env
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Chi bat tao SKU khi da audit danh sach thieu:

```env
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=true
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_MAX_PER_RUN=50
SYNC_CREATE_MISSING_SHOPIFY_SKU_ALLOWLIST=
```

Neu muon tao toan bo SKU thieu Shopify:

```env
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=true
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_MAX_PER_RUN=0
SYNC_CREATE_MISSING_SHOPIFY_SKU_ALLOWLIST=
```

He thong da chan tao combo SKU tren Shopify. Pancake co logic combo rieng.

Blocklist SKU:

```env
SYNC_PRODUCT_SYNC_SKU_BLOCKLIST=
SYNC_PRODUCT_SYNC_SKU_BLOCKLIST_FILE=reports/product-sync-sku-blocklist.json
```

Dam bao file blocklist ton tai:

```bash
mkdir -p reports
test -f reports/product-sync-sku-blocklist.json || echo "[]" > reports/product-sync-sku-blocklist.json
```

## 6. Cai Nginx va SSL

Cai Nginx + Certbot:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

Tao config:

```bash
nano /etc/nginx/sites-available/fitme-backend
```

Noi dung:

```nginx
server {
    listen 80;
    server_name <DOMAIN>;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
ln -s /etc/nginx/sites-available/fitme-backend /etc/nginx/sites-enabled/fitme-backend
nginx -t
systemctl reload nginx
```

Cap SSL:

```bash
certbot --nginx -d <DOMAIN>
```

Kiem tra auto-renew:

```bash
certbot renew --dry-run
```

## 7. Build va chay Docker

Trong thu muc backend:

```bash
cd /opt/fitme/fitme-sportswear/fitme-sportswear-backend
```

Build va start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Kiem tra containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

Xem log:

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
```

Kiem tra health noi bo:

```bash
curl http://127.0.0.1:3000/health/readiness
```

Kiem tra qua domain:

```bash
curl https://<DOMAIN>/health/readiness
```

Ket qua dung:

```json
{"status":"ready","dependencies":{"database":"ok"}}
```

## 8. Kiem tra webhook

### 8.1. Pancake

Gan URL:

```text
https://<DOMAIN>/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
```

Neu dang test:

- Dat `PANCAKE_TEST_ORDER_FILTER=WEBHOOK_TEST`.
- Tao don tren Pancake co note `WEBHOOK_TEST`.
- Kiem tra Telegram va bang `webhook_events`.

Query webhook events:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c 'select id, "sourcePlatform", status, "externalOrderId", "createdAt" from webhook_events order by "createdAt" desc limit 20;'
```

### 8.2. Shopify

Neu `SHOPIFY_WEBHOOK_AUTO_REGISTER_ENABLED=true`, worker se tu dang ky webhook khi start.

Kiem tra log:

```bash
docker compose -f docker-compose.prod.yml logs worker | grep "Shopify webhook"
```

Can thay:

```text
Shopify webhook orders/create updated/unchanged: https://<DOMAIN>/webhooks/shopify/order
Shopify webhook orders/cancelled updated/unchanged: https://<DOMAIN>/webhooks/shopify/order
```

Neu dang test:

- Dat `SHOPIFY_TEST_ORDER_FILTER=WEBHOOK_TEST`.
- Tao order Shopify co note/tag/attribute `WEBHOOK_TEST`.
- Kiem tra Telegram va bang `webhook_events`.

## 9. Trigger sync thu cong

Dat bien local:

```bash
export SYNC_API_TOKEN='<SYNC_API_TOKEN>'
```

Trigger product/inventory sync:

```bash
curl -X POST https://<DOMAIN>/sync/products \
  -H "x-sync-api-token: $SYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

Lay `id` tra ve, roi check:

```bash
curl https://<DOMAIN>/sync/products/<SYNC_RUN_ID> \
  -H "x-sync-api-token: $SYNC_API_TOKEN"
```

Trigger Sapo -> Pancake inventory sync rieng:

```bash
curl -X POST https://<DOMAIN>/sync/sapo-to-pancake-inventory \
  -H "x-sync-api-token: $SYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

## 10. Theo doi Telegram khi live

Cac message quan trong:

### Sapo -> Pancake inventory

```text
Sapo -> Pancake inventory sync completed
updatedTotalThisRun=...
remaining=...
candidates=...
hotCandidates=...
backlogCandidates=...
```

### Sapo -> Shopify inventory

```text
Sapo -> Shopify inventory sync running
stage=snapshots_refreshed
shopifySnapshots=...
shopifyMappings=...
totalMappings=...
```

Khi bat dau update/tang tao SKU:

```text
Sapo -> Shopify inventory sync progress
stage=updating_shopify
shopifyCandidates=...
hotShopifyCandidates=...
backlogShopifyCandidates=...
processedShopify=...
remainingShopify=...
updatedShopify=...
createdShopify=...
shopifyErrors=...
```

## 11. Van hanh hang ngay

Xem containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

Xem log API:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 api
```

Xem log worker:

```bash
docker compose -f docker-compose.prod.yml logs --tail=300 worker
```

Restart worker khi doi scheduler/env sync:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate worker
```

Restart API khi doi webhook/env API:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

Rebuild sau khi pull code moi:

```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build api worker
```

## 12. Backup database

Tao backup:

```bash
mkdir -p /opt/fitme/backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U fitme fitme_sportswear_backend \
  > /opt/fitme/backups/fitme_$(date +%Y%m%d_%H%M%S).sql
```

Restore backup:

```bash
cat /opt/fitme/backups/<backup-file>.sql | \
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U fitme -d fitme_sportswear_backend
```

Nen backup truoc khi:

- Bat tao SKU hang loat.
- Chay migration moi.
- Chuyen tu test filter sang live full.

## 13. Checklist chuyen tu test sang live

1. Da co domain HTTPS on dinh.
2. `curl https://<DOMAIN>/health/readiness` tra ready.
3. Shopify webhook log da `updated` hoac `unchanged` dung domain.
4. Pancake webhook da gan dung:

   ```text
   https://<DOMAIN>/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
   ```

5. Telegram nhan duoc message test.
6. Tao don test Pancake co `WEBHOOK_TEST`, Sapo tao dung nguoi nhan/SKU/status.
7. Tao don test Shopify co `WEBHOOK_TEST`, Sapo tao dung nguoi nhan/SKU/status.
8. Huy don 2 chieu da dung cho Pancake/Sapo va Shopify/Sapo.
9. Inventory sync Sapo -> Pancake va Sapo -> Shopify co log thanh cong.
10. Neu chay live that, xoa filter:

    ```env
    PANCAKE_TEST_ORDER_FILTER=
    SHOPIFY_TEST_ORDER_FILTER=
    ```

11. Restart:

    ```bash
    docker compose -f docker-compose.prod.yml up -d --force-recreate api worker
    ```

## 14. Canh bao quan trong

- Khong dung Cloudflare quick tunnel cho live. Dung domain/VPS/Nginx/SSL.
- Khong expose Postgres/Redis ra internet.
- Khong commit `.env` live len Git.
- Neu bat `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=true`, nen bat tung dot nho truoc:

  ```env
  SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_MAX_PER_RUN=50
  ```

- Chi dat `MAX_PER_RUN=0` khi da audit danh sach SKU thieu.
- He thong lay Sapo lam nguon ton kho chinh; khong sync ton kho tu Pancake/Shopify ve Sapo.
- Neu Telegram bao permission Sapo/Shopify bi thieu, phai cap quyen token/app roi restart worker.
