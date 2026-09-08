# Plan go-live PreOrder — chỉ đồng bộ Sapo khi đã thanh toán

## Mục tiêu

Áp dụng cho mọi đơn có ít nhất một SKU PreOrder. Shopify là nơi nhân sự xác nhận thanh toán; Sapo chỉ nhận đơn PreOrder đã trả đủ tiền. Đơn chưa thanh toán không giữ quota và kho không xử lý.

## Luồng mục tiêu

1. Khách đặt giỏ có SKU PreOrder và chọn **Chuyển khoản**.
2. Shopify tạo đơn có Payment status `pending`.
3. Backend nhận `orders/create`, ghi nội bộ `PREORDER_PENDING_PAYMENT`, nhưng không tạo đơn Sapo và không tính quota.
4. Nhân sự đối soát tiền vào ngân hàng, sau đó vào Shopify Admin và chọn **Mark as paid**.
5. Shopify chuyển đơn sang `paid` và gửi webhook `orders/updated`.
6. Backend tạo chính xác một đơn Sapo, ghi nhận tiền, quota và ghi chú `PREORDER - ĐÃ THANH TOÁN`.
7. Khi tồn Sapo về, hệ thống phân bổ theo thứ tự các đơn đã thanh toán; chỉ tạo fulfillment khi đơn được cấp phát đủ hàng.
8. Nếu quá thời hạn thanh toán mà vẫn chưa trả tiền, Shopify Flow tự hủy đơn. Đơn đó không có Sapo/quota để xử lý tiếp.

## Quy tắc payment status

| Shopify financial status | Xử lý PreOrder |
| --- | --- |
| `paid` | Đồng bộ Sapo, ghi nhận tiền và quota. |
| `pending` | `PREORDER_PENDING_PAYMENT`; không tạo Sapo. |
| `unpaid` | `PREORDER_PENDING_PAYMENT`; không tạo Sapo. |
| `authorized` | `PREORDER_PENDING_PAYMENT`; không tạo Sapo. |
| `partially_paid` | `PREORDER_PENDING_PAYMENT`; không tạo Sapo. |
| `cancelled` | Hủy bản ghi chờ nội bộ; không phát sinh vận hành Sapo. |

Quy tắc bắt buộc: chỉ `paid` mới được xem là đủ điều kiện xử lý PreOrder.

## Phạm vi backend cần hoàn thiện

1. Nhận và tự đăng ký webhook Shopify `orders/updated`.
2. Với đơn có SKU PreOrder nhưng chưa `paid`, tạo/cập nhật bản ghi chờ thanh toán nội bộ; không tạo Sapo, không giữ quota.
3. Khi nhận cập nhật `paid`, tạo/finalize đúng một đơn Sapo, tạo phiếu thu đúng một lần và ghi nhận quota đúng một lần.
4. Ghi chú Sapo không ghi đè note thủ công:
   - Chưa thanh toán: không có đơn Sapo; trạng thái nội bộ là `PREORDER_PENDING_PAYMENT`.
   - Đã thanh toán: `PREORDER - ĐÃ THANH TOÁN` và ghi chú hàng chờ phân bổ.
5. Chặn fulfillment với PreOrder chưa được cấp phát tồn kho.
6. Tạo job đối soát định kỳ các đơn `PREORDER_PENDING_PAYMENT` với Shopify API để phục hồi khi webhook chậm hoặc thất lạc.
7. Đảm bảo idempotency cho webhook lặp và race condition giữa `orders/create`/`orders/updated`.
8. Có endpoint vận hành được bảo vệ bằng Sync API token:
   - `GET /preorders/operations`: SKU đang bật, quota đã giữ/còn lại, lượng chờ hàng, lượng sẵn sàng xử lý và cảnh báo vượt quota.
   - `GET /preorders/orders?status=waiting|ready|all`: danh sách đơn PreOrder đã thanh toán theo thứ tự tạo.

Đơn thường hoặc COD không có SKU PreOrder giữ nguyên luồng đồng bộ hiện hành.

## Shopify Flow — tự hủy đơn chưa trả tiền

Dùng Shopify Flow miễn phí với thời hạn khuyến nghị ban đầu là **60 phút**.

1. Trigger: `Order created`.
2. Điều kiện: đơn chứa một trong các SKU PreOrder được bật.
3. Điều kiện: Payment status là `pending` hoặc `unpaid`.
4. Action: `Wait` 60 phút.
5. Sau Wait, kiểm tra lại:
   - vẫn `pending`/`unpaid`;
   - chưa fulfilled;
   - chưa bị hủy.
6. Action: `Cancel order`, hoàn tồn kho và không hoàn tiền.
7. Tuỳ chọn: gắn tag `PREORDER_EXPIRED_UNPAID`, gửi email hủy cho khách và thông báo nội bộ.

Flow phải kiểm tra lại trạng thái sau Wait. Nếu nhân sự đã Mark as paid trước hạn, điều kiện không còn đúng và đơn không bị hủy.

## Trình tự triển khai

1. Hoàn thiện code backend payment-gate và test unit/integration.
2. Deploy backend nhưng chưa bật SKU PreOrder.
3. Cấu hình Shopify Flow ở trạng thái test/inactive, rà soát điều kiện SKU và hành động hủy.
4. Test bằng SKU test:
   - pending không có Sapo;
   - Mark as paid tạo đúng một đơn Sapo;
   - webhook lặp không trùng đơn/phiếu thu/quota;
   - Flow hủy đơn quá hạn;
   - đơn thường/COD không đổi hành vi.
5. Chỉ khi toàn bộ test có bằng chứng tại Shopify và Sapo mới bật bốn SKU ATSO02 thực tế.

## Ngoài phạm vi plan này

Plan này dùng phương thức **Chuyển khoản thủ công**. Hiển thị QR động tại checkout hoặc trang cảm ơn là hạng mục riêng; không phải điều kiện để payment-gate hoạt động.

## Trạng thái mã nguồn (07/09/2026, chưa deploy payment-gate)

- Đã hoàn tất ở mã nguồn: webhook `orders/updated`, payment gate, tạo Sapo/phiếu thu sau `paid`, bảo toàn ghi chú, chặn fulfillment khi chưa đủ hàng, FIFO phân bổ, quota được khóa nguyên tử khi xác nhận thanh toán, cảnh báo paid-over-quota, đối soát định kỳ khi webhook chậm/mất, và báo cáo vận hành có token.
- Chưa triển khai: deploy backend payment-gate, bật SKU PreOrder thật, cấu hình/active Shopify Flow 60 phút, và kiểm thử thực tế Shopify–Sapo theo danh sách bên trên.
