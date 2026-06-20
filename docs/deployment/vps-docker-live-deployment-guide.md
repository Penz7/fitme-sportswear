# Hướng Dẫn Triển Khai Live Backend FitMe Trên VPS Bằng Docker

Tài liệu này dùng để đưa backend FitMe Sportswear lên VPS chạy live cho các luồng:

- Pancake -> Sapo: tạo đơn, cập nhật trạng thái, hủy đơn qua webhook.
- Shopify -> Sapo: tạo đơn, hủy đơn qua webhook/reconcile.
- Sapo -> Pancake: polling cập nhật trạng thái đơn.
- Sapo -> Shopify: polling cập nhật trạng thái đơn.
- Sapo -> Pancake inventory: đồng bộ tồn kho từ Sapo sang Pancake.
- Sapo -> Shopify inventory: đồng bộ tồn kho từ Sapo sang Shopify, không tự tạo SKU nếu tắt biến tạo SKU.

Nguyên tắc vận hành chính:

- Sapo là nguồn tồn kho chính.
- Không đồng bộ tồn từ Pancake/Shopify ngược về Sapo.
- Không dùng Cloudflare quick tunnel cho live. Live phải dùng domain ổn định qua Nginx + HTTPS.
- Không commit file `.env` thật lên Git.
- Khi chưa chắc chắn, bật filter `WEBHOOK_TEST` để test đơn trước.

## 1. Kiến trúc Docker

Hệ thống gồm 4 service:

- `api`: nhận webhook, health check, API trigger sync thủ công.
- `worker`: xử lý queue, scheduler, order sync, inventory sync.
- `postgres`: database chính.
- `redis`: queue/cache/lock cho BullMQ job.

Ở production:

- Chỉ public domain HTTPS qua Nginx.
- API chỉ bind nội bộ `127.0.0.1:3000`.
- Postgres/Redis không expose ra internet.
- `worker` là nơi chạy scheduler và đăng ký Shopify webhook tự động.

## 2. Yêu Cầu VPS

Khuyến nghị:

- Ubuntu 22.04/24.04 hoặc Debian tương đương.
- 2 vCPU trở lên.
- RAM 4 GB trở lên.
- Disk 40 GB trở lên.
- Domain/subdomain trỏ về VPS, ví dụ `api.fitme.vn`.
- Quyền SSH `root` hoặc user có `sudo`.

Port cần mở:

- `80`: cấp SSL bằng Certbot.
- `443`: webhook/API live qua HTTPS.
- Không mở public `5432`, `6379`, `3000`.

### 2.1. Không Mua Domain Mới Thì Dùng Gì?

Nếu shop Shopify đã có domain `fitme.vn` đang hoạt động, không cần mua thêm domain mới. Không trỏ domain chính `fitme.vn` về VPS, vì domain này đang dùng cho website bán hàng Shopify.

Cách đúng là tạo subdomain riêng cho backend:

```text
api.fitme.vn
```

Subdomain này trỏ về IP VPS và chỉ dùng cho webhook/API backend.

Trạng thái hiện tại đã kiểm tra:

```text
api.fitme.vn -> 14.225.224.184
```

Nếu VPS live vẫn là `14.225.224.184`, không cần mua domain và không cần chỉnh DNS thêm.

DNS record cần tạo nếu sau này đổi sang VPS khác:

```text
Type: A
Name: api
Value: <VPS_IP>
TTL: Auto hoặc 300
```

Sau khi DNS hoạt động:

```text
https://api.fitme.vn
```

sẽ là domain backend live.

Cấu hình `.env` nên dùng:

```env
SHOPIFY_WEBHOOK_PUBLIC_BASE_URL=https://api.fitme.vn
```

Webhook Pancake live:

```text
https://api.fitme.vn/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
```

Shopify webhook do worker tự đăng ký:

```text
orders/create    -> https://api.fitme.vn/webhooks/shopify/order
orders/cancelled -> https://api.fitme.vn/webhooks/shopify/order
```

Không chỉnh 3 domain đang có sẵn trong Shopify:

```text
fitme.vn
1f5119.myshopify.com
www.fitme.vn
```

Ba domain này đang phục vụ website bán hàng Shopify. Chỉ tạo thêm subdomain mới là `api.fitme.vn`.

### 2.2. Cách Tạo `api.fitme.vn` Trên Shopify Domains

Trong màn hình Shopify bạn đang thấy `Miền`, thao tác như sau:

1. Vào `Shopify Admin`.
2. Vào `Settings`.
3. Vào `Domains`.
4. Bấm vào domain chính `fitme.vn`.
5. Tìm phần quản lý DNS hoặc `DNS settings`.
6. Bấm `Add custom record` hoặc `Thêm bản ghi`.
7. Chọn loại bản ghi `A`.
8. Điền:

```text
Type: A
Name / Host: api
Points to / Value: <VPS_IP>
TTL: Auto
```

Ví dụ theo VPS hiện tại:

```text
Type: A
Name / Host: api
Points to / Value: 14.225.224.184
TTL: Auto
```

Không nhập:

```text
Name / Host: api.fitme.vn
```

Nếu ô `Name / Host` nằm trong DNS của `fitme.vn`, chỉ nhập `api`. Hệ thống DNS sẽ tự hiểu thành `api.fitme.vn`.

Không tạo hoặc sửa các record này:

```text
@      -> Shopify
www    -> Shopify
1f5119 -> Shopify
```

Nếu không thấy nút chỉnh DNS trong Shopify, nghĩa là DNS có thể đang nằm ở nhà cung cấp domain khác hoặc Cloudflare. Khi đó làm tương tự ở nơi quản lý DNS thật:

```text
Type: A
Name / Host: api
Value: <VPS_IP>
TTL: Auto hoặc 300
```

Kiểm tra DNS đã trỏ đúng:

```bash
dig +short api.fitme.vn
curl -I http://api.fitme.vn
```

Kết quả `dig` phải trả về IP VPS. Lúc chưa cấp SSL, `curl -I http://api.fitme.vn` có thể trả `502` hoặc response từ Nginx, nhưng không được báo không tìm thấy host.

Nếu chưa muốn dùng `api.fitme.vn`, có thể dùng dịch vụ miễn phí như DuckDNS hoặc `sslip.io`, nhưng `api.fitme.vn` là phương án tốt nhất vì đã có domain thật và ổn định.

## 3. Cài Gói Cơ Bản Trên VPS

SSH vào VPS:

```bash
ssh root@<VPS_IP>
```

Cập nhật hệ thống:

```bash
apt update && apt upgrade -y
```

Cài công cụ cần thiết:

```bash
apt install -y git curl ca-certificates gnupg ufw nginx certbot python3-certbot-nginx
```

Cài Docker và Docker Compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Kiểm tra:

```bash
docker version
docker compose version
```

Cấu hình firewall tối thiểu:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 4. Clone Source

Tạo thư mục deploy:

```bash
mkdir -p /opt/fitme
cd /opt/fitme
```

Clone repo:

```bash
git clone https://github.com/Penz7/fitme-sportswear.git fitme-sportswear
cd /opt/fitme/fitme-sportswear
git checkout main
git pull origin main
```

Vào thư mục backend:

```bash
cd /opt/fitme/fitme-sportswear/fitme-sportswear-backend
```

## 5. Tạo Docker Compose Production

Tạo file:

```bash
nano docker-compose.prod.yml
```

Nội dung đề xuất:

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

## 6. Tạo File `.env` Live

Tạo từ mẫu:

```bash
cp .env.example .env
nano .env
```

### 6.1. Biến hệ thống bắt buộc

```env
APP_ENV=production
APP_PORT=3000
APP_VERSION=live

POSTGRES_PASSWORD=<mật-khẩu-postgres-rất-mạnh>
SYNC_API_TOKEN=<token-nội-bộ-rất-mạnh>
```

### 6.2. Sapo

```env
SAPO_BASE_URL=https://fitme-sportswear.mysapogo.com
SAPO_ACCOUNT_BASE_URL=https://accounts.sapo.vn
SAPO_PHONE_NUMBER=<sapo-phone>
SAPO_PASSWORD=<sapo-password>
SAPO_CLIENT_ID=<sapo-client-id>
SAPO_SHOP_DOMAIN=fitme-sportswear.mysapogo.com
SAPO_LOCATION_ID=<sapo-main-location-id>
SAPO_PRODUCT_REQUEST_TIMEOUT_MS=30000
SAPO_LOGIN_COOLDOWN_MS=1800000
SAPO_LOCATION_ID_BY_PANCAKE_WAREHOUSE_ID={}
SAPO_PREPAYMENT_METHOD_ID=<sapo-payment-method-id>
SAPO_PREPAYMENT_METHOD_NAME=Chuyen khoan
```

Hệ thống đang dùng cơ chế session Sapo Go giống source cũ để làm việc đúng với dashboard `mysapogo.com`.

`SAPO_LOGIN_COOLDOWN_MS` giúp tránh spam login vào `accounts.sapo.vn`. Nếu Sapo Accounts trả `403` hoặc `429`, worker sẽ tạm dừng login lại trong thời gian này. Giá trị `1800000` là 30 phút.

Quyền/tài khoản Sapo cần đủ:

- Đọc sản phẩm, đơn hàng, tồn kho.
- Tạo đơn.
- Cập nhật đơn.
- Hủy đơn.
- Tạo/cập nhật customer.
- Tạo/hủy/xử lý fulfillment.
- Ghi nhận thanh toán nếu dùng đơn chuyển khoản/prepaid.

### 6.3. Pancake

```env
PANCAKE_BASE_URL=https://pos.pages.fm/api/v1
PANCAKE_API_KEY=<pancake-api-key>
PANCAKE_SHOP_ID=<pancake-shop-id>
PANCAKE_DEFAULT_WAREHOUSE_ID=<pancake-default-warehouse-id>
PANCAKE_WEBHOOK_SECRET=<pancake-webhook-secret-live>
PANCAKE_PRODUCT_REQUEST_TIMEOUT_MS=60000
PANCAKE_PRODUCT_RETRY_ATTEMPTS=3
PANCAKE_PRODUCT_RETRY_BACKOFF_MS=1000
```

Webhook Pancake live:

```text
https://<DOMAIN>/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
```

Trong Pancake:

- Bật Webhook URL.
- Dữ liệu: `Đơn hàng`.
- Đối tác: có thể để `Không có`.
- Request headers có thể để trống nếu đã dùng `?secret=...`.

Khi đã chạy trên VPS, không dùng tunnel Cloudflare nữa. URL webhook phải dùng domain HTTPS thật của VPS, ví dụ:

```text
https://api.fitme.vn/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
```

Không dùng dạng:

```text
https://xxxxx.trycloudflare.com/webhook?secret=...
```

Tunnel chỉ phù hợp để test local tạm thời. Live cần domain ổn định để Pancake luôn gọi được webhook.

### 6.4. Shopify

```env
SHOPIFY_BASE_URL=https://<shop-name>.myshopify.com/admin/api/2025-07
SHOPIFY_API_VERSION=2025-07
SHOPIFY_ACCESS_TOKEN=<shopify-admin-access-token>
SHOPIFY_LOCATION_ID=<shopify-location-id>
SHOPIFY_WEBHOOK_SECRET=<shopify-webhook-secret>
SHOPIFY_WEBHOOK_PUBLIC_BASE_URL=https://<DOMAIN>
SHOPIFY_WEBHOOK_AUTO_REGISTER_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=true
SHOPIFY_PRODUCT_FETCH_PAGE_DELAY_MS=750
SHOPIFY_PRODUCT_FETCH_MAX_RETRIES=5
SHOPIFY_PRODUCT_FETCH_RETRY_BASE_DELAY_MS=2000
```

Khi `worker` khởi động, hệ thống tự đăng ký/cập nhật webhook Shopify:

```text
orders/create    -> https://<DOMAIN>/webhooks/shopify/order
orders/cancelled -> https://<DOMAIN>/webhooks/shopify/order
```

Khi chạy trên VPS, `SHOPIFY_WEBHOOK_PUBLIC_BASE_URL` phải là domain HTTPS thật:

```env
SHOPIFY_WEBHOOK_PUBLIC_BASE_URL=https://api.fitme.vn
```

Không dùng tunnel Cloudflare trong biến này. Worker sẽ dùng biến trên để gọi Shopify Admin API và cập nhật webhook tự động. Nếu đổi domain, cần restart worker:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate worker
```

Quyền Shopify app cần có:

- `read_orders`, `write_orders`
- `read_products`, `write_products`
- `read_inventory`, `write_inventory`
- `read_locations`
- `read_fulfillments`, `write_fulfillments`
- Các fulfillment scope bổ sung nếu Shopify yêu cầu trong shop.

### 6.5. Telegram

```env
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<telegram-chat-id>
```

Telegram dùng để nhận:

- Webhook/order failed.
- Inventory sync progress.
- Sapo -> Pancake inventory/order sync.
- Sapo -> Shopify inventory/order sync.
- Cảnh báo thiếu permission, thiếu mapping, lỗi API.

### 6.6. Webhook test/live

Chạy test trước khi live:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=true
PANCAKE_TEST_ORDER_FILTER=WEBHOOK_TEST
SHOPIFY_TEST_ORDER_FILTER=WEBHOOK_TEST
```

Khi bật filter, hệ thống chỉ xử lý đơn có note/tag/marker `WEBHOOK_TEST`.

Chạy live thật:

```env
WEBHOOK_INGESTION_ENABLED=true
PANCAKE_WEBHOOK_ENABLED=true
SHOPIFY_WEBHOOK_ENABLED=true
PANCAKE_TEST_ORDER_FILTER=
SHOPIFY_TEST_ORDER_FILTER=
```

### 6.7. Scheduler order sync

Khuyến nghị live cân bằng:

```env
SYNC_SCHEDULER_ENABLED=true
SYNC_SAPO_TOP_ORDER_CRON=* * * * *
SYNC_SAPO_TOP_ORDER_SHOPIFY_CRON=* * * * *
SYNC_SAPO_TOP_ORDER_LIMIT=50
SYNC_SHOPIFY_ORDER_RECONCILE_CRON=*/2 * * * *
SYNC_SHOPIFY_ORDER_RECONCILE_LIMIT=10
SYNC_SAPO_TO_PANCAKE_ORDER_CRON=
```

Ý nghĩa:

- Sapo -> Pancake: polling mỗi 1 phút.
- Sapo -> Shopify: polling mỗi 1 phút.
- Shopify cancel -> Sapo: reconcile mỗi 2 phút.
- Pancake/Shopify -> Sapo: chủ yếu qua webhook, gần realtime.

Không khuyến nghị polling 10 giây cho live vì dễ tăng tải API Sapo/Pancake/Shopify.

Nếu Sapo vừa unblock IP VPS, không bật toàn bộ scheduler ngay. Nên chạy API trước, bật worker với filter test, trigger một sync nhỏ để xác nhận login Sapo thành công, rồi mới bật đủ scheduler.

### 6.8. Scheduler inventory sync

```env
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
```

Ý nghĩa:

- Sapo -> Pancake inventory: mỗi 10 phút.
- Sapo -> Shopify inventory: mỗi 10 phút qua `product-inventory-sync`.
- SKU mới/có `updatedAt` gần được ưu tiên theo nhóm hot candidates.
- SKU backlog cũ được xử lý dần để tránh quá tải API.

### 6.9. Tạo SKU thiếu

Khuyến nghị live an toàn:

```env
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=false
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Shopify đang chạy an toàn nhất khi chỉ đồng bộ tồn cho SKU đã tồn tại.

Chỉ bật tạo SKU Shopify theo đợt đã audit:

```env
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=true
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_MAX_PER_RUN=50
SYNC_CREATE_MISSING_SHOPIFY_SKU_ALLOWLIST=
```

Không bật tạo toàn bộ SKU thiếu nếu chưa audit:

```env
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS_MAX_PER_RUN=0
```

Chỉ dùng `MAX_PER_RUN=0` khi đã chắc chắn danh sách SKU thiếu là đúng và có thể tạo hàng loạt.

Blocklist SKU:

```env
SYNC_PRODUCT_SYNC_SKU_BLOCKLIST=
SYNC_PRODUCT_SYNC_SKU_BLOCKLIST_FILE=reports/product-sync-sku-blocklist.json
```

Đảm bảo file blocklist tồn tại:

```bash
mkdir -p reports
test -f reports/product-sync-sku-blocklist.json || echo "[]" > reports/product-sync-sku-blocklist.json
```

## 7. Cấu Hình Reverse Proxy Và SSL

Trong các lệnh dưới đây, thay `<DOMAIN>` bằng domain backend live. Với FitMe, khuyến nghị dùng:

```text
api.fitme.vn
```

Hiện tại `api.fitme.vn` đang trỏ về VPS `14.225.224.184` và server trả header `Server: Caddy`. Vì vậy trên VPS hiện tại nên ưu tiên cấu hình **Caddy**. Chỉ dùng Nginx nếu VPS chưa cài Caddy hoặc bạn quyết định chuyển sang Nginx.

### 7.1. Kiểm Tra Caddy Hiện Có Trên VPS

SSH vào VPS:

```bash
ssh root@14.225.224.184
```

Kiểm tra Caddy:

```bash
systemctl status caddy --no-pager
caddy version
```

Kiểm tra file cấu hình:

```bash
ls -la /etc/caddy
sed -n '1,200p' /etc/caddy/Caddyfile
```

Nếu Caddy đang chạy, dùng cấu hình ở mục 7.2.

### 7.2. Cấu Hình Caddy Cho `api.fitme.vn`

Mở Caddyfile:

```bash
nano /etc/caddy/Caddyfile
```

Thêm hoặc sửa block `api.fitme.vn` thành:

```caddy
api.fitme.vn {
    encode gzip

    reverse_proxy 127.0.0.1:3000
}
```

Nếu trong Caddyfile đã có block `api.fitme.vn`, không tạo block trùng. Chỉ sửa block cũ để proxy về:

```text
127.0.0.1:3000
```

Kiểm tra cấu hình:

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Reload Caddy:

```bash
systemctl reload caddy
```

Kiểm tra HTTP tự redirect sang HTTPS:

```bash
curl -I http://api.fitme.vn
```

Kết quả mong muốn:

```text
HTTP/1.1 308 Permanent Redirect
Location: https://api.fitme.vn/
Server: Caddy
```

Kiểm tra HTTPS:

```bash
curl -I https://api.fitme.vn
```

Nếu backend chưa chạy, có thể thấy `502 Bad Gateway` hoặc `404` tùy cấu hình cũ. Sau khi Docker API chạy ở port `3000`, kiểm tra lại:

```bash
curl https://api.fitme.vn/health/readiness
```

Kết quả đúng:

```json
{"status":"ready","dependencies":{"database":"ok"}}
```

Caddy sẽ tự cấp và gia hạn SSL cho `api.fitme.vn`, không cần chạy Certbot nếu dùng Caddy.

### 7.3. Chỉ Dùng Nginx Nếu Không Dùng Caddy

Nếu VPS không dùng Caddy, có thể dùng Nginx. Không chạy đồng thời Caddy và Nginx cùng chiếm port `80/443`.

Kiểm tra port trước:

```bash
ss -ltnp | grep -E ':80|:443'
```

Nếu `caddy` đang chiếm port `80/443`, không cấu hình Nginx song song trừ khi đã dừng Caddy.

Tạo Nginx site:

```bash
nano /etc/nginx/sites-available/fitme-backend
```

Nội dung:

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

Enable:

```bash
ln -s /etc/nginx/sites-available/fitme-backend /etc/nginx/sites-enabled/fitme-backend
nginx -t
systemctl reload nginx
```

Cấp SSL:

```bash
certbot --nginx -d <DOMAIN>
certbot renew --dry-run
```

Ví dụ cho FitMe:

```bash
certbot --nginx -d api.fitme.vn
certbot renew --dry-run
```

Sau khi cấp SSL xong, kiểm tra:

```bash
curl -I https://api.fitme.vn/health/readiness
```

Nếu API chưa chạy, có thể trả `502 Bad Gateway`. Trường hợp đó vẫn chứng minh domain và SSL đã về đúng reverse proxy; tiếp tục chạy Docker ở bước sau.

## 8. Thứ Tự Chạy Lần Đầu

Vào backend:

```bash
cd /opt/fitme/fitme-sportswear/fitme-sportswear-backend
```

Kiểm tra file quan trọng:

```bash
test -f .env
test -f docker-compose.prod.yml
test -f reports/product-sync-sku-blocklist.json
```

Kiểm tra domain/reverse proxy trước khi chạy Docker:

```bash
dig +short api.fitme.vn
curl -I http://api.fitme.vn
```

Kết quả mong muốn:

```text
14.225.224.184
HTTP/1.1 308 Permanent Redirect
Server: Caddy
```

Nếu `dig` không trả `14.225.224.184`, cần kiểm tra lại DNS ở Mắt Bão. Nếu `curl` không thấy `Server: Caddy`, cần kiểm tra lại reverse proxy trên VPS.

Build image:

```bash
docker compose -f docker-compose.prod.yml build
```

Chạy database/redis trước:

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml ps
```

Chạy API:

```bash
docker compose -f docker-compose.prod.yml up -d api
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

Kiểm tra API nội bộ:

```bash
curl http://127.0.0.1:3000/health/readiness
```

Kiểm tra API qua domain:

```bash
curl https://<DOMAIN>/health/readiness
```

Kết quả đúng:

```json
{"status":"ready","dependencies":{"database":"ok"}}
```

Chạy worker:

```bash
docker compose -f docker-compose.prod.yml up -d worker
docker compose -f docker-compose.prod.yml logs --tail=200 worker
```

Log cần thấy:

```text
Worker started
Registered product-inventory-sync schedule
Registered sapo-to-pancake-inventory-sync schedule
Registered sapo-top-order-sync schedule
Shopify webhook orders/create updated/unchanged
Shopify webhook orders/cancelled updated/unchanged
```

## 9. Chạy Lấy Backlog Trước Khi Mở Live

Hệ thống đã có scheduler tự chạy product/inventory sync mỗi 10 phút. Tuy nhiên khi deploy VPS mới lần đầu, vẫn phải chủ động chạy backlog thủ công trước khi mở live.

Lý do không nên để scheduler tự xử lý vòng đầu:

- Backlog SKU/tồn kho lần đầu thường lớn.
- Nếu đơn thật vào cùng lúc, khó phân biệt lỗi do order webhook hay do inventory backlog.
- Pancake/Shopify API có thể bị tải cao ở vòng đầu.
- Telegram/log sẽ dễ theo dõi hơn khi chủ động chạy từng vòng.

Mục tiêu của bước này là đưa tồn kho hiện tại của Pancake/Shopify gần với Sapo nhất có thể, trước khi nhận đơn thật.

Quy tắc:

- Scheduler 10 phút vẫn là cơ chế vận hành lâu dài.
- Vòng backlog đầu tiên phải chạy thủ công và theo dõi.
- Sau khi backlog ổn, scheduler sẽ tự duy trì các vòng sau.
- Không bật tạo SKU Shopify hàng loạt trong lần chạy đầu nếu chưa audit.

Giữ filter test trong lúc kéo backlog:

```env
PANCAKE_TEST_ORDER_FILTER=WEBHOOK_TEST
SHOPIFY_TEST_ORDER_FILTER=WEBHOOK_TEST
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
```

Restart API/worker nếu vừa đổi `.env`:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api worker
```

Set token nội bộ:

```bash
export SYNC_API_TOKEN='<SYNC_API_TOKEN>'
```

Trigger Sapo -> Shopify inventory/product sync:

```bash
curl -X POST https://<DOMAIN>/sync/products \
  -H "x-sync-api-token: $SYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

Trigger Sapo -> Pancake inventory sync:

```bash
curl -X POST https://<DOMAIN>/sync/sapo-to-pancake-inventory \
  -H "x-sync-api-token: $SYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

Theo dõi trạng thái:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c 'select id, "syncType", status, "startedAt", "finishedAt", "errorMessage", metadata from sync_runs order by "createdAt" desc limit 10;'
```

Cần theo dõi các trường trong `metadata`:

- `remaining`: số SKU lệch còn lại.
- `candidates`: số SKU cần xử lý trong vòng đó.
- `hotCandidates`: SKU mới/có cập nhật gần.
- `backlogCandidates`: SKU lệch cũ.
- `updatedShopify`, `updatedPancake`, `updated`, `failed`.
- `createdShopify`: phải bằng `0` nếu `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false`.

Nếu backlog còn lớn, có thể trigger thêm vài vòng. Không cần ép về `remaining=0` tuyệt đối nếu còn SKU thiếu, duplicate, conflict hoặc blocklist. Các SKU đó cần xử lý bằng report/audit riêng.

Sau khi chạy backlog thủ công xong:

1. Giữ nguyên filter `WEBHOOK_TEST`.
2. Tạo 1 đơn Pancake test có note `WEBHOOK_TEST`.
3. Tạo 1 đơn Shopify test có note/tag `WEBHOOK_TEST`.
4. Kiểm tra Sapo tạo đơn đúng người nhận, SKU, số lượng, trạng thái.
5. Test hủy đơn hai chiều.
6. Test chuyển trạng thái từ Sapo sang Pancake/Shopify.
7. Chỉ khi các bước trên ổn mới xóa filter để nhận đơn thật.

Chỉ chuyển sang live khi:

1. `api.fitme.vn` trỏ đúng `14.225.224.184`.
2. Caddy proxy `api.fitme.vn` về `127.0.0.1:3000`.
3. Health check OK.
4. Webhook test Pancake/Shopify OK.
5. Order status sync test OK.
6. Inventory sync đã chạy ít nhất một vòng cho Pancake và Shopify.
7. `createdShopify=0` khi đang tắt tạo SKU Shopify.
8. Không còn sync run `running/queued` bị kẹt bất thường.

Nếu có run bị stale do restart giữa chừng, mark failed trước khi chạy lại:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c "update sync_runs set status='failed', \"finishedAt\"=now(), \"errorMessage\"='Manually marked stale before live backlog refresh' where status in ('queued','running');"
```

## 10. Kiểm Tra Webhook

### 10.1. Pancake

Gắn URL:

```text
https://<DOMAIN>/webhook?secret=<PANCAKE_WEBHOOK_SECRET>
```

Test:

1. Để `PANCAKE_TEST_ORDER_FILTER=WEBHOOK_TEST`.
2. Tạo đơn Pancake có note `WEBHOOK_TEST`.
3. Kiểm tra Telegram.
4. Kiểm tra bảng webhook:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c 'select id, "sourcePlatform", status, "externalOrderId", "createdAt" from webhook_events order by "createdAt" desc limit 20;'
```

### 10.2. Shopify

Nếu `SHOPIFY_WEBHOOK_AUTO_REGISTER_ENABLED=true`, worker tự đăng ký webhook.

Kiểm tra log:

```bash
docker compose -f docker-compose.prod.yml logs worker | grep "Shopify webhook"
```

Test:

1. Để `SHOPIFY_TEST_ORDER_FILTER=WEBHOOK_TEST`.
2. Tạo order Shopify có note/tag/attribute `WEBHOOK_TEST`.
3. Kiểm tra Telegram.
4. Kiểm tra `webhook_events`.

## 11. Trigger Sync Thủ Công

Set token:

```bash
export SYNC_API_TOKEN='<SYNC_API_TOKEN>'
```

Trigger Sapo -> Shopify inventory/product sync:

```bash
curl -X POST https://<DOMAIN>/sync/products \
  -H "x-sync-api-token: $SYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

Trigger Sapo -> Pancake inventory sync:

```bash
curl -X POST https://<DOMAIN>/sync/sapo-to-pancake-inventory \
  -H "x-sync-api-token: $SYNC_API_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

Kiểm tra sync run:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c 'select id, "syncType", status, "startedAt", "finishedAt", "errorMessage", metadata from sync_runs order by "createdAt" desc limit 10;'
```

## 12. Checklist Test Tổng Quan Trước Khi Live

Chạy theo thứ tự:

1. `dig +short api.fitme.vn` trả `14.225.224.184`.
2. `curl -I http://api.fitme.vn` trả redirect HTTPS từ Caddy.
3. `curl https://<DOMAIN>/health/readiness` trả `ready`.
4. Worker log có `Worker started`.
5. Worker log có Shopify webhook `updated` hoặc `unchanged` đúng domain.
6. Telegram nhận được message khi có lỗi/test.
7. Pancake webhook gắn đúng URL live.
8. Shopify webhook tự đăng ký đúng URL live.
9. Tạo đơn Pancake có `WEBHOOK_TEST`.
10. Sapo tạo đơn đúng người nhận, SKU, số lượng, trạng thái.
11. Hủy đơn Pancake, Sapo hủy theo.
12. Chuyển trạng thái ở Sapo, Pancake cập nhật trong vòng polling 1 phút.
13. Tạo đơn Shopify có `WEBHOOK_TEST`.
14. Sapo tạo đơn đúng người nhận, SKU, số lượng, trạng thái.
15. Hủy đơn Shopify, Sapo hủy theo qua webhook/reconcile.
16. Chuyển trạng thái ở Sapo, Shopify cập nhật trong vòng polling 1 phút.
17. Chạy inventory sync thủ công một vòng.
18. Telegram có log Sapo -> Pancake inventory.
19. Telegram có log Sapo -> Shopify inventory.
20. Xác nhận `createdShopify=0` nếu `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false`.

Khi các bước trên đạt yêu cầu, mới xóa filter:

```env
PANCAKE_TEST_ORDER_FILTER=
SHOPIFY_TEST_ORDER_FILTER=
```

Restart API/worker sau khi đổi filter:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api worker
```

## 13. Theo Dõi Khi Live

Xem container:

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

Theo dõi sync run:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c 'select id, "syncType", status, "startedAt", "finishedAt", "errorMessage" from sync_runs order by "createdAt" desc limit 20;'
```

Các message Telegram quan trọng:

```text
Sapo -> Pancake inventory sync completed
Sapo -> Shopify inventory sync running
Sapo -> Shopify inventory sync progress
Webhook event processing failed
Bypassed Sapo fulfillment because address mapping is incomplete
```

## 14. Dừng, Clear Job, Và Chạy Lại Sạch

Dừng hệ thống:

```bash
docker compose -f docker-compose.prod.yml down
```

Nếu cần clear queue/job cache Redis:

```bash
docker compose -f docker-compose.prod.yml up -d redis
docker compose -f docker-compose.prod.yml exec -T redis redis-cli FLUSHALL
docker compose -f docker-compose.prod.yml exec -T redis redis-cli DBSIZE
docker compose -f docker-compose.prod.yml down
```

Nếu có sync run bị stale trong database, mark failed trước khi chạy lại:

```bash
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U fitme -d fitme_sportswear_backend \
  -c "update sync_runs set status='failed', \"finishedAt\"=now(), \"errorMessage\"='Manually stopped before restart' where status in ('queued','running');"
```

Sau đó chạy lại:

```bash
docker compose -f docker-compose.prod.yml up -d api worker
```

## 15. Backup Và Restore Database

Tạo backup:

```bash
mkdir -p /opt/fitme/backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U fitme fitme_sportswear_backend \
  > /opt/fitme/backups/fitme_$(date +%Y%m%d_%H%M%S).sql
```

Restore:

```bash
cat /opt/fitme/backups/<backup-file>.sql | \
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U fitme -d fitme_sportswear_backend
```

Nên backup trước khi:

- Chuyển từ test filter sang live full.
- Bật tạo SKU hàng loạt.
- Chạy migration mới.
- Deploy code thay đổi lớn.

## 16. Update Code Sau Này

Vào thư mục repo:

```bash
cd /opt/fitme/fitme-sportswear
git pull origin main
cd fitme-sportswear-backend
```

Rebuild và restart:

```bash
docker compose -f docker-compose.prod.yml up -d --build api worker
```

Nếu chỉ đổi `.env` scheduler/webhook:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api worker
```

Nếu chỉ đổi scheduler:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate worker
```

## 17. Cảnh Báo Quan Trọng

- Không dùng Cloudflare quick tunnel cho live.
- Không expose Postgres/Redis ra internet.
- Không commit `.env` live.
- Không bật tạo SKU Shopify hàng loạt nếu chưa audit SKU thiếu.
- Nếu `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false`, hệ thống vẫn sync tồn cho SKU Shopify đã có.
- Nếu SKU thiếu trên Shopify, hệ thống sẽ không tạo và không sync tồn cho SKU đó.
- Nếu SKU bị duplicate/conflict/blocklist, hệ thống sẽ skip để tránh update sai.
- Tồn kho luôn lấy Sapo làm nguồn chính.
- Khi Sapo đổi trạng thái đơn, Pancake/Shopify nhận theo polling, không realtime tuyệt đối.
- Khi Pancake/Shopify tạo/hủy đơn, Sapo nhận qua webhook/reconcile nhanh hơn.
- Nếu Telegram báo thiếu permission, cần cấp quyền token/app rồi restart worker.
