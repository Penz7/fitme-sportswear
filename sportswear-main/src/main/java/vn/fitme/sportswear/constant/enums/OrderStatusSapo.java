package vn.fitme.sportswear.constant.enums;

import java.util.Arrays;

import lombok.AllArgsConstructor;
import lombok.Getter;

import static vn.fitme.sportswear.constant.SapoConstant.RETURN_STATUS;
import static vn.fitme.sportswear.constant.SapoConstant.STATUS;

@Getter
@AllArgsConstructor
public enum OrderStatusSapo {

  // Trạng thái đơn hàng
  DAT_HANG(STATUS, "draft"),
  GIAO_DICH(STATUS, "finalized"),
  HOAN_THANH(STATUS, "completed"),
  DA_HUY(STATUS, "cancelled"),
  KET_THUC(STATUS, "finished"),

  // Trạng thái đóng gói
  CHUA_DONG_GOI("packed_status", "unpacked"),
  DA_DONG_GOI("packed_status", "packed"),

  // Trạng thái xuất kho
  CHUA_XUAT_KHO("fulfillment_status", "unshipped"),
  DA_XUAT_KHO("fulfillment_status", "shipped"),

  // Trạng thái nhận hàng
  CHUA_NHAN("received_status", "unreceived"),
  DA_NHAN("received_status", "received"),

  // Trạng thái thanh toán
  CHUA_THANH_TOAN("payment_status", "unpaid"),
  DA_THANH_TOAN("payment_status", "paid"),

  // Trạng thái hoàn trả
  CHUA_TRA_HANG(RETURN_STATUS, "unreturned"),
  TRA_MOT_PHAN(RETURN_STATUS, "partial"),
  DA_TRA_HANG(RETURN_STATUS, "returned"),
  ;
  private final String key;
  private final String value;

  public static OrderStatusSapo findByValue(String value) {
    return Arrays.stream(OrderStatusSapo.values())
        .filter(status -> status.getValue().equals(value))
        .findFirst()
        .orElse(null);
  }
}
