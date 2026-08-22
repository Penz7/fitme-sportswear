# Checklist Chức Năng Cần Bổ Sung

Ngày: 2026-08-22

Phạm vi: tài liệu báo cáo chức năng. Không bao gồm nội dung kỹ thuật hoặc thay đổi hệ thống.

## 1. Đồng Bộ Mã Vận Đơn Viettel Post

- [ ] Khi kho tạo mã vận đơn Viettel Post, Shopify cần cập nhật đúng mã vận đơn Viettel Post.
- [ ] Mã vận đơn cần được cập nhật kể cả khi đơn hàng chưa chuyển sang trạng thái hoàn thành.
- [ ] Không được hiển thị mã đóng gói thay cho mã vận đơn Viettel Post.
- [ ] Đơn hàng đã có mã vận đơn đúng thì không cập nhật lặp lại gây trùng thông tin.
- [ ] Đơn hủy không được cập nhật vận đơn mới.

## 2. Gửi Email Mã Vận Chuyển Cho Khách Hàng

- [ ] Khi đơn hàng có mã vận đơn Viettel Post hợp lệ, Shopify gửi email thông báo vận chuyển cho khách.
- [ ] Email cần hiển thị đúng mã vận đơn.
- [ ] Email nên hiển thị đúng đơn vị vận chuyển là Viettel Post.
- [ ] Khách hàng chỉ nhận email khi đơn hàng đã có mã vận đơn thật.
- [ ] Không gửi email vận chuyển khi đơn mới chỉ có mã đóng gói hoặc chưa bàn giao vận chuyển.

## 3. Đồng Bộ Voucher, Giảm Giá Và Phí Vận Chuyển

- [ ] Voucher trên Shopify cần được ghi nhận đúng trên Sapo.
- [ ] Giảm giá trên từng sản phẩm cần được ghi nhận đúng.
- [ ] Giảm giá trên toàn đơn cần được ghi nhận đúng.
- [ ] Phí vận chuyển trên Shopify cần được ghi nhận đúng trên Sapo.
- [ ] Trường hợp miễn phí vận chuyển cần được ghi nhận đúng.
- [ ] Tổng tiền đơn hàng giữa Shopify và Sapo cần khớp nhau.
- [ ] Số tiền cần thu của khách cần khớp với hình thức thanh toán.

## 4. Đồng Bộ Ghi Chú Đơn Hàng

- [ ] Ghi chú khách hàng nhập trên Shopify cần hiển thị trên Sapo.
- [ ] Thông tin đặc biệt của đơn hàng cần được đưa vào ghi chú để kho dễ xử lý.
- [ ] Đơn PreOrder cần có ghi chú rõ ràng là hàng đặt trước.
- [ ] Không được ghi đè ghi chú thủ công của kho hoặc chăm sóc khách hàng.
- [ ] Ghi chú cần ngắn gọn, dễ hiểu và đúng cho vận hành.

## 5. Mở PreOrder Cho Sản Phẩm Được Chỉ Định

- [ ] Chỉ bật PreOrder cho những sản phẩm hoặc mã hàng được chỉ định.
- [ ] Không bật PreOrder cho toàn bộ shop.
- [ ] Sản phẩm còn hàng vẫn hiển thị mua hàng bình thường.
- [ ] Sản phẩm hết hàng và được phép PreOrder thì hiển thị trạng thái đặt trước.
- [ ] Sản phẩm hết hàng nhưng không được phép PreOrder thì hiển thị hết hàng.
- [ ] Có thể bật hoặc tắt PreOrder riêng cho từng sản phẩm hoặc từng mã hàng.

## 6. Giới Hạn Số Lượng PreOrder

- [ ] Mỗi sản phẩm PreOrder có thể đặt giới hạn số lượng nhận đặt trước.
- [ ] Khi đặt đủ giới hạn, sản phẩm không nhận thêm PreOrder mới.
- [ ] Số lượng đang chờ hàng cần được theo dõi riêng.
- [ ] Khi có hàng về, hàng mới cần ưu tiên xử lý cho đơn PreOrder cũ trước.
- [ ] Chỉ cho bán hàng bình thường lại khi đã trừ hết số lượng đang nợ PreOrder.

## 7. Xử Lý Tồn Kho Khi Có Đơn PreOrder

- [ ] Hệ thống cần phân biệt tồn kho thật và số lượng khách đã đặt trước.
- [ ] Nếu tồn kho Sapo về 5 sản phẩm nhưng đang có 10 sản phẩm PreOrder, không được mở bán bình thường ngay.
- [ ] Nếu tồn kho Sapo về 15 sản phẩm và đang có 10 sản phẩm PreOrder, chỉ 5 sản phẩm còn lại được mở bán bình thường.
- [ ] Đơn PreOrder cũ cần được ưu tiên theo thứ tự đặt hàng trước.
- [ ] Không để sản phẩm khác bị ảnh hưởng khi chỉ bật PreOrder cho một sản phẩm cụ thể.

## 8. Trạng Thái Và Nhận Diện Đơn PreOrder

- [ ] Đơn PreOrder cần được đánh dấu rõ ràng trên Shopify.
- [ ] Đơn PreOrder cần được ghi chú rõ ràng trên Sapo.
- [ ] Kho cần nhìn biết đơn nào là đơn đặt trước.
- [ ] Chăm sóc khách hàng cần lọc được danh sách đơn đang chờ hàng.
- [ ] Khi có hàng về, đơn PreOrder cần được chuyển sang trạng thái sẵn sàng xử lý.
- [ ] Đơn PreOrder chỉ được giao cho vận chuyển khi đã có hàng và kho xử lý.

## 9. Thanh Toán Cho Đơn PreOrder

- [ ] Sản phẩm PreOrder nên bắt buộc thanh toán trước.
- [ ] Sản phẩm bình thường vẫn có thể cho khách chọn COD hoặc thanh toán trước.
- [ ] Nếu giỏ hàng có sản phẩm PreOrder, nên ẩn hoặc chặn COD cho cả giỏ hàng.
- [ ] Nếu giỏ hàng chỉ có sản phẩm bình thường, COD vẫn hiển thị bình thường.
- [ ] Cần xác nhận Shopify hiện tại có cho phép ẩn COD theo sản phẩm PreOrder hay cần dùng ứng dụng hỗ trợ.
- [ ] Đơn chuyển khoản thủ công chỉ được xem là đã thanh toán khi có xác nhận thanh toán rõ ràng.

## 10. Nội Dung Hiển Thị Cho Khách Hàng

- [ ] Nút mua hàng của sản phẩm đặt trước cần hiển thị rõ là PreOrder hoặc Đặt trước.
- [ ] Trang sản phẩm cần thông báo đây là hàng đặt trước.
- [ ] Cần hiển thị thời gian dự kiến có hàng nếu có thông tin.
- [ ] Cần thông báo rõ chính sách giao hàng, đổi trả hoặc hủy đơn cho hàng đặt trước.
- [ ] Email xác nhận đơn hàng nên nói rõ sản phẩm là hàng đặt trước.
- [ ] Email vận chuyển chỉ gửi khi đơn đã có mã vận đơn thật.

## 11. Báo Cáo Và Theo Dõi Vận Hành

- [ ] Có danh sách sản phẩm đang bật PreOrder.
- [ ] Có danh sách đơn PreOrder đang chờ hàng.
- [ ] Có danh sách số lượng PreOrder theo từng mã hàng.
- [ ] Có danh sách đơn đã được phân bổ hàng và sẵn sàng xử lý.
- [ ] Có cảnh báo khi số lượng PreOrder vượt giới hạn.
- [ ] Có cảnh báo khi tồn kho trên Shopify và Sapo không khớp.
- [ ] Có cảnh báo khi sản phẩm đang PreOrder nhưng không còn nằm trong danh sách được phép PreOrder.

## 12. Các Tình Huống Cần Kiểm Tra

- [ ] Sản phẩm không được bật PreOrder và hết hàng thì khách không mua được.
- [ ] Sản phẩm được bật PreOrder và hết hàng thì khách đặt trước được.
- [ ] Sản phẩm PreOrder đặt đủ giới hạn thì không nhận thêm đơn đặt trước.
- [ ] Đơn PreOrder hiển thị đúng ghi chú trên Shopify và Sapo.
- [ ] Đơn PreOrder chưa có hàng thì không giao cho vận chuyển.
- [ ] Sapo nhập hàng một phần thì ưu tiên đơn PreOrder cũ trước.
- [ ] Sapo nhập hàng đủ để trả hết PreOrder thì phần dư mới được mở bán bình thường.
- [ ] Sản phẩm PreOrder bắt buộc thanh toán trước nếu Shopify/ứng dụng hỗ trợ.
- [ ] Sản phẩm bình thường vẫn cho COD.
- [ ] Khi có mã vận đơn Viettel Post thật, Shopify cập nhật mã vận đơn và gửi email cho khách.

## 13. Mức Ưu Tiên Để Triển Khai

1. Đồng bộ đúng mã vận đơn Viettel Post và gửi email vận chuyển cho khách.
2. Đồng bộ đúng voucher, giảm giá, phí vận chuyển và ghi chú đơn hàng.
3. Bật PreOrder riêng cho sản phẩm/mã hàng được chỉ định.
4. Hiển thị nút PreOrder và nội dung thông báo cho khách hàng.
5. Theo dõi số lượng PreOrder đang chờ hàng.
6. Xử lý phân bổ hàng cho đơn PreOrder khi Sapo nhập hàng.
7. Giới hạn số lượng PreOrder để tránh bán quá mức mong muốn.
8. Kiểm tra khả năng bắt buộc thanh toán trước và ẩn COD cho sản phẩm PreOrder.
9. Bổ sung báo cáo vận hành cho kho và chăm sóc khách hàng.
