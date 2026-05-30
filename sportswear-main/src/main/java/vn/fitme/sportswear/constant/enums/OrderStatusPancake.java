package vn.fitme.sportswear.constant.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Getter
@AllArgsConstructor
public enum OrderStatusPancake {
  NEW(0, "Mới"), // Moi
  WAITING_FOR_STOCK(11, "Chờ hàng"), // Cho hang
  CONFIRMED(1, "Đã xác nhận"), // Xac nhan don hang
  PACKING(8, "Đang đóng hàng"), // Dang dong hang
  WAITING_FOR_SHIPPING(9, "Chờ chuyển hàng"), // Cho chuyen hang --> thay doi ton kho
  SHIPPED(2, "Đã gửi hàng"), // Gui hang di
  RECEIVED(3, "Đã nhận"), // Khach da nhan duoc
  MONEY_COLLECTED(16, "Đã thu tiền"), // Da thu tien
  RETURNING(4, "Đang trả hàng"), // Khach tra lai
  RETURNED(5, "Đã hoàn"), // Da hoan toan bo --> thay doi ton kho
  CANCEL_ORDER(6, "Hủy đơn"), // Huy don
  DELETE_ORDER(7, "Xóa đơn"), // Huy don

  ORDERED(20, "Đã đặt hàng"),
  WAITING_FOR_PRINT(12, "Chờ in"),
  PRINTED(13, "Đã in"),
  PARTIALLY_RETURNED(15, "Hoàn 1 phần"),
  ;
  private final int code;
  private final String description;
  private static final Map<Integer, OrderStatusPancake> CODE_TO_ENUM =
      EnumSet.allOf(OrderStatusPancake.class).stream()
          .collect(Collectors.toMap(OrderStatusPancake::getCode, Function.identity()));

  public static OrderStatusPancake findByCode(int code) {
    return CODE_TO_ENUM.getOrDefault(code, null);
  }
}
