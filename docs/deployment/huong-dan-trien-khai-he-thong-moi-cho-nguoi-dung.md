# Hướng dẫn triển khai hệ thống Fitme Sportswear mới

Tài liệu này dành cho người không chuyên kỹ thuật nhưng cần cài đặt, cấu hình và kiểm tra hệ thống đồng bộ mới `fitme-sportswear-backend`.

Hệ thống mới thay thế cách chạy Java cũ bằng backend NestJS mới. Người vận hành không cần hiểu code, chỉ cần làm đúng các bước trong tài liệu này.

## 1. Hệ thống mới làm gì?

Hệ thống mới dùng để đồng bộ dữ liệu giữa:

- Sapo: nguồn chính về sản phẩm, tồn kho và đơn hàng.
- Pancake: kênh bán hàng, gửi webhook khi đơn hàng thay đổi.
- Shopify: kênh bán hàng, gửi webhook và nhận thông tin fulfillment/tracking.

Hệ thống mới gồm 2 thành phần chạy song song:

- API: nhận webhook từ Pancake/Shopify và nhận lệnh đồng bộ thủ công.
- Worker: xử lý các việc đồng bộ ở phía sau.

Nếu chỉ chạy API mà không chạy Worker, hệ thống có thể nhận webhook nhưng không xử lý đồng bộ.

## 2. Cần chuẩn bị trước khi triển khai

Trước khi bắt đầu, cần có các thông tin sau:

| Nhóm | Thông tin cần có | Lấy ở đâu |
| --- | --- | --- |
| Server | Địa chỉ server hoặc VPS | Đơn vị cung cấp server |
| Domain | Domain public có HTTPS, ví dụ `https://api.fitme.vn` | Đơn vị quản lý domain |
| Sapo | Tài khoản, mật khẩu, shop domain, location ID | Quản trị Sapo |
| Pancake | Base URL, API key, shop/page ID | Quản trị Pancake |
| Shopify | Shop domain, access token, location ID, webhook secret | Shopify admin/app |
| Telegram | Bot token và chat ID, nếu muốn nhận thông báo lỗi | Telegram BotFather/nhóm chat |

Không gửi token, mật khẩu, API key qua chat công khai. Không đưa các thông tin này vào file tài liệu chung.

## 3. Địa chỉ webhook cần cấu hình

Giả sử domain backend mới là:

```text
https://api.fitme.vn
```

Thì các webhook cần cấu hình như sau.

### Pancake

Dùng URL mới:

```text
https://api.fitme.vn/webhooks/pancake/v1
```

Nếu đang chuyển từ Java cũ và muốn giữ đường dẫn cũ trong thời gian ngắn, backend mới vẫn hỗ trợ:

```text
https://api.fitme.vn/webhook
```

Khuyến nghị dùng URL mới `/webhooks/pancake/v1` để dễ quản lý về sau.

### Shopify

Cấu hình các webhook Shopify:

```text
https://api.fitme.vn/webhooks/shopify/order
https://api.fitme.vn/webhooks/shopify/product
https://api.fitme.vn/webhooks/shopify/fulfillment
```

Backend mới cũng hỗ trợ các URL cũ:

```text
https://api.fitme.vn/webhooks/order
https://api.fitme.vn/webhooks/product
https://api.fitme.vn/webhooks/fulfillment
```

Khuyến nghị dùng URL mới có chữ `shopify` trong đường dẫn.

## 4. Điền file cấu hình `.env`

Đi vào thư mục backend mới:

```powershell
cd C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend
```

Nếu chưa có file `.env`, tạo từ file mẫu:

```powershell
copy .env.example .env
```

Mở file `.env` và điền thông tin thật.

### Cấu hình chung

```env
APP_ENV=production
APP_PORT=3000
APP_VERSION=0.1.0
```

### Cấu hình database và Redis

Nếu chạy bằng Docker Compose như tài liệu này, giữ nguyên:

```env
DATABASE_URL=postgresql://fitme:fitme@localhost:5433/fitme_sportswear_backend?schema=public
REDIS_HOST=localhost
REDIS_PORT=6380
```

Trong Docker, hệ thống tự đổi sang địa chỉ nội bộ `postgres` và `redis`, nên người vận hành không cần sửa phần này nếu dùng `docker compose`.

### Cấu hình Sapo

```env
SAPO_BASE_URL=https://<dia-chi-sapo>
SAPO_ACCOUNT_BASE_URL=https://accounts.sapo.vn
SAPO_PHONE_NUMBER=<so-dien-thoai-dang-nhap-sapo>
SAPO_PASSWORD=<mat-khau-sapo>
SAPO_CLIENT_ID=<client-id-sapo>
SAPO_SHOP_DOMAIN=<shop-domain-sapo>
SAPO_LOCATION_ID=<location-id-sapo>
```

### Cấu hình Pancake

```env
PANCAKE_BASE_URL=https://<dia-chi-api-pancake>
PANCAKE_API_KEY=<api-key-pancake>
PANCAKE_SHOP_ID=<shop-id-hoac-page-id-pancake>
```

### Cấu hình Shopify

```env
SHOPIFY_BASE_URL=https://<ten-shop>.myshopify.com
SHOPIFY_ACCESS_TOKEN=<access-token-shopify>
SHOPIFY_API_VERSION=2024-04
SHOPIFY_LOCATION_ID=<location-id-shopify>
SHOPIFY_WEBHOOK_SECRET=<webhook-secret-shopify>
```

Nếu Shopify báo lỗi webhook `401 Invalid Shopify webhook signature`, thường là do `SHOPIFY_WEBHOOK_SECRET` sai hoặc chưa khớp với secret trong Shopify app.

### Cấu hình Telegram, nếu có

```env
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>
```

Nếu không dùng Telegram, có thể để trống:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Cấu hình đồng bộ tự động

Khuyến nghị production:

```env
SYNC_SCHEDULER_ENABLED=true
SYNC_STARTUP_PRODUCT_SYNC_ENABLED=true
SYNC_CREATE_MISSING_PANCAKE_PRODUCTS=true
SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=false
SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=false
```

Ý nghĩa các dòng quan trọng:

| Biến | Nên để | Ý nghĩa |
| --- | --- | --- |
| `SYNC_SCHEDULER_ENABLED` | `true` | Bật các lịch đồng bộ tự động |
| `SYNC_STARTUP_PRODUCT_SYNC_ENABLED` | `true` | Khi hệ thống khởi động, tự động đồng bộ sản phẩm |
| `SYNC_CREATE_MISSING_PANCAKE_PRODUCTS` | `true` | Nếu Pancake thiếu sản phẩm, tạo từ Sapo |
| `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS` | `false` | Không tự tạo sản phẩm Shopify nếu chưa chắc chắn |
| `SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER` | `false` | Tránh cập nhật tồn kho trùng lặp theo đơn |

Nếu muốn hành vi sát Java cũ hơn, có thể đổi:

```env
SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=true
```

Chỉ bật biến này khi đã xác nhận không có hệ thống khác cùng đang trừ tồn kho theo đơn hàng.

## 5. Chạy hệ thống bằng Docker

Từ thư mục backend:

```powershell
cd C:\Users\tanda\Downloads\fitme-sportswear\fitme-sportswear-backend
```

Chạy toàn bộ hệ thống:

```powershell
docker compose up --build -d
```

Lệnh này sẽ chạy:

- PostgreSQL
- Redis
- API
- Worker

Kiểm tra trạng thái:

```powershell
docker compose ps
```

Cần thấy các service đang `Up`:

```text
postgres
redis
api
worker
```

## 6. Kiểm tra hệ thống sau khi chạy

Mở trình duyệt hoặc dùng lệnh sau:

```powershell
curl http://localhost:3000/health
```

Kết quả đúng:

```json
{"status":"ok"}
```

Kiểm tra database:

```powershell
curl http://localhost:3000/health/readiness
```

Cần thấy database ở trạng thái `ok` hoặc `ready`.

Kiểm tra webhook đã sẵn sàng:

```powershell
curl http://localhost:3000/webhooks/internal/status
```

Kết quả đúng là có thông báo webhook đã sẵn sàng cho Pancake và Shopify.

## 7. Cấu hình Pancake

Làm trên giao diện quản trị Pancake:

1. Vào phần cấu hình tích hợp hoặc webhook.
2. Điền API key nếu Pancake yêu cầu.
3. Điền webhook URL:

```text
https://api.fitme.vn/webhooks/pancake/v1
```

4. Lưu cấu hình.
5. Tạo hoặc cập nhật thử một đơn hàng trên Pancake.
6. Kiểm tra log backend:

```powershell
docker compose logs api --tail=80
docker compose logs worker --tail=80
```

Nếu webhook vào đúng, API sẽ có log nhận request. Nếu Worker xử lý đúng, Worker sẽ có log xử lý job.

## 8. Cấu hình Shopify

Làm trên Shopify admin hoặc Shopify app:

1. Vào phần webhook.
2. Tạo webhook cho order:

```text
https://api.fitme.vn/webhooks/shopify/order
```

3. Tạo webhook cho product:

```text
https://api.fitme.vn/webhooks/shopify/product
```

4. Tạo webhook cho fulfillment:

```text
https://api.fitme.vn/webhooks/shopify/fulfillment
```

5. Kiểm tra webhook secret trong Shopify app và điền đúng vào `.env`:

```env
SHOPIFY_WEBHOOK_SECRET=<webhook-secret-shopify>
```

6. Restart hệ thống sau khi sửa `.env`:

```powershell
docker compose up --build -d
```

7. Tạo/cập nhật thử một order Shopify và xem log:

```powershell
docker compose logs api --tail=80
docker compose logs worker --tail=80
```

## 9. Các lệnh đồng bộ thủ công

Khi cần test hoặc chạy lại đồng bộ, có thể dùng các lệnh sau.

Đồng bộ sản phẩm:

```powershell
curl -X POST http://localhost:3000/sync/products
```

Đồng bộ địa chỉ:

```powershell
curl -X POST http://localhost:3000/sync/address-mappings
```

Đồng bộ đơn Sapo sang Pancake theo lô:

```powershell
curl -X POST http://localhost:3000/sync/sapo-to-pancake-orders/bulk -H "Content-Type: application/json" -d "{}"
```

Đồng bộ các top order từ Sapo:

```powershell
curl -X POST http://localhost:3000/sync/sapo-to-pancake-orders/top-orders
```

Đồng bộ theo log Sapo:

```powershell
curl -X POST http://localhost:3000/sync/sapo-logs
```

Cleanup sản phẩm Shopify:

```powershell
curl -X POST http://localhost:3000/sync/shopify-product-cleanup
```

Với production domain, thay `http://localhost:3000` bằng domain thật:

```text
https://api.fitme.vn
```

## 10. Kiểm tra khi có lỗi

### Lỗi: Pancake gọi webhook nhưng hệ thống không xử lý

Kiểm tra:

```powershell
docker compose ps
docker compose logs api --tail=100
docker compose logs worker --tail=100
```

Nếu `api` không `Up`, webhook sẽ không vào được.

Nếu `worker` không `Up`, webhook có thể vào nhưng không được xử lý.

### Lỗi: Shopify báo `401 Invalid Shopify webhook signature`

Nguyên nhân thường gặp:

- Sai `SHOPIFY_WEBHOOK_SECRET`.
- Sửa `.env` nhưng chưa restart backend.
- Shopify đang gửi webhook từ app khác với secret khác.

Cách xử lý:

1. Kiểm tra lại secret trong Shopify app.
2. Cập nhật `.env`.
3. Restart:

```powershell
docker compose up --build -d
```

### Lỗi: API không kết nối database

Kiểm tra PostgreSQL:

```powershell
docker compose ps
docker compose logs postgres --tail=80
```

Nếu mới tạo server lần đầu, chạy lại:

```powershell
docker compose up --build -d
```

### Lỗi: Job không chạy

Kiểm tra Redis và Worker:

```powershell
docker compose ps
docker compose logs redis --tail=80
docker compose logs worker --tail=100
```

Nếu Redis hoặc Worker không chạy, queue sẽ không xử lý.

### Lỗi: Sai token/API key

Dấu hiệu:

- API ngoài trả 401/403.
- Log có nội dung unauthorized, forbidden, invalid token.

Cách xử lý:

1. Kiểm tra lại token/API key trong Pancake, Shopify, Sapo.
2. Sửa file `.env`.
3. Restart backend.

## 11. Khi nào cần restart hệ thống?

Cần restart sau khi:

- Sửa `.env`.
- Đổi token/API key.
- Đổi webhook secret Shopify.
- Cập nhật source code.
- Cập nhật Docker image.

Lệnh restart:

```powershell
docker compose up --build -d
```

## 12. So sánh với tài liệu Java cũ

| Java cũ | Hệ thống mới |
| --- | --- |
| Chạy file `.jar` | Chạy Docker Compose |
| `application.yaml` | File `.env` |
| Một service Java | Hai process: API và Worker |
| Pancake webhook `/webhook` | Pancake webhook `/webhooks/pancake/v1` |
| Port thường gặp `8080`/`8081` | Port nội bộ backend mới `3000` |
| Không có queue rõ ràng | Có Redis/BullMQ để xử lý nền |

Đường dẫn webhook Pancake cũ vẫn được hỗ trợ để giảm rủi ro khi chuyển đổi:

```text
https://api.fitme.vn/webhook
```

Nhưng khi cấu hình mới, nên dùng:

```text
https://api.fitme.vn/webhooks/pancake/v1
```

## 13. Checklist bàn giao sau triển khai

Sau khi triển khai xong, cần đánh dấu đủ các mục sau:

- [ ] API đang chạy.
- [ ] Worker đang chạy.
- [ ] PostgreSQL đang chạy.
- [ ] Redis đang chạy.
- [ ] `GET /health` trả về thành công.
- [ ] `GET /health/readiness` trả về thành công.
- [ ] Pancake webhook đã cấu hình đúng domain.
- [ ] Shopify order webhook đã cấu hình.
- [ ] Shopify product webhook đã cấu hình.
- [ ] Shopify fulfillment webhook đã cấu hình.
- [ ] Đã test đồng bộ sản phẩm.
- [ ] Đã test đơn hàng Pancake.
- [ ] Đã test đơn hàng Shopify.
- [ ] Đã kiểm tra log API.
- [ ] Đã kiểm tra log Worker.

## 14. Quy tắc an toàn khi vận hành

- Không commit file `.env`.
- Không gửi token/API key qua nhóm chat công khai.
- Trước khi bật `SYNC_CREATE_MISSING_SHOPIFY_PRODUCTS=true`, cần xác nhận muốn hệ thống tự tạo sản phẩm lên Shopify.
- Trước khi bật `SYNC_UPDATE_PANCAKE_INVENTORY_BY_ORDER=true`, cần xác nhận không có đồng bộ tồn kho trùng lặp.
- Khi có lỗi đơn hàng, xem log Worker trước, vì Worker mới là nơi xử lý nghiệp vụ.
