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
