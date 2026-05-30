package vn.fitme.sportswear.service.pancake.order.request;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.order.dto.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderData {
  private String billFullName;
  private String billPhoneNumber;
  private Boolean receivedAtShop;
  private String pageId;
  private String account;
  private String accountName;
  private String adsSource;
  private String statusName;
  private Integer status;
  private String insertedAt;
  private String updatedAt;
  private String assigningSellerId;
  private String note;
  private String notePrint;
  private Integer returnedReason;
  private List<StatusHistory> statusHistory;
  private Long systemId;
  private Long shopId;
  private String orderLink;
  private Long moneyToCollect;
  private Long id;
  private Boolean isFreeShipping;
  private Creator creator;
  private String linkConfirmOrder;
  private List<Item> items;
  private String warehouseId;
  private String orderCurrency;
  private Double totalQuantity;
  private Double totalPrice;
  private LastEditor lastEditor;
  private ShippingAddress shippingAddress;
  private WarehouseInfo warehouseInfo;
  private Map<String, Object> advancedPlatformFee;
  private BigDecimal prepaid;
  private BigDecimal shippingFee;
  private BigDecimal totalDiscount;
  private String customId;
}
