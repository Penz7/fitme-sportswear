package vn.fitme.sportswear.constant.enums;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Getter
@Slf4j
public enum OrderType {
  PLACED(OrderStatusPancake.NEW.getCode(), List.of(OrderStatusSapo.DAT_HANG)),
  APPROVED(
      OrderStatusPancake.CONFIRMED.getCode(),
      List.of(OrderStatusSapo.GIAO_DICH, OrderStatusSapo.CHUA_DONG_GOI)),
  PACKED(
      OrderStatusPancake.PACKING.getCode(),
      List.of(OrderStatusSapo.GIAO_DICH, OrderStatusSapo.DA_DONG_GOI, OrderStatusSapo.CHUA_XUAT_KHO)),
  SHIPPED(
      OrderStatusPancake.SHIPPED.getCode(),
      List.of(OrderStatusSapo.GIAO_DICH, OrderStatusSapo.DA_XUAT_KHO)),
  COMPLETED(OrderStatusPancake.MONEY_COLLECTED.getCode(), List.of(OrderStatusSapo.HOAN_THANH)),
  CANCELED(OrderStatusPancake.CANCEL_ORDER.getCode(), List.of(OrderStatusSapo.DA_HUY)),

  // Bổ sung thêm, không có trên Sapo
  RETURNING(OrderStatusPancake.RETURNING.getCode(), List.of(OrderStatusSapo.TRA_MOT_PHAN)),
  RETURNED(OrderStatusPancake.RETURNED.getCode(), List.of(OrderStatusSapo.DA_TRA_HANG)),
  RECEIVED(
      OrderStatusPancake.RECEIVED.getCode(),
      List.of(OrderStatusSapo.DA_NHAN, OrderStatusSapo.CHUA_THANH_TOAN)),
  PAID(OrderStatusPancake.MONEY_COLLECTED.getCode(), List.of(OrderStatusSapo.DA_THANH_TOAN));

  private final int code;
  private final List<OrderStatusSapo> sapoStatuses;

  OrderType(int code, List<OrderStatusSapo> sapoStatuses) {
    this.code = code;
    this.sapoStatuses = sapoStatuses;
  }

  private static final Map<OrderStatusSapo, OrderType> SAPO_TO_TYPE_MAP =
      new EnumMap<>(OrderStatusSapo.class);

  static {
    for (OrderType type : OrderType.values()) {
      for (OrderStatusSapo status : type.sapoStatuses) {
        if(!OrderStatusSapo.GIAO_DICH.equals(status)){
          SAPO_TO_TYPE_MAP.put(status, type);
        }
      }
    }
    log.info("SAPO_TO_TYPE_MAP: {}", SAPO_TO_TYPE_MAP);
  }

  public static OrderType fromSapoStatus(OrderStatusSapo status) {
    return SAPO_TO_TYPE_MAP.getOrDefault(status, null);
  }

  public static List<OrderStatusSapo> findSapoStatusesByCode(int code) {
    for (OrderType orderType : values()) {
      if (orderType.getCode() == code) {
        return orderType.getSapoStatuses();
      }
    }
    return null; // or throw exception if code is not found
  }
}
