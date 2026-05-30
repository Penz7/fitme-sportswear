package vn.fitme.sportswear.processor.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@NoArgsConstructor
@AllArgsConstructor
public class OrderDTO {
  private Long id;
  private String orderLink;
  private String statusName;
  private Integer status;
  private Integer totalQuantity;
  private Double totalPrice;
  private Double totalDiscount;
  private Double moneyToCollect;
  private Double cod;
  private Double chargedByCard;
  private Double chargedByMomo;
  private Double chargedByQrpay;
  private Double shippingFee;
  private Double prepaid;
  private Double exchangePayment;
  private Boolean isFreeShipping;
  private String orderCurrency;
  private String note;
  private String eventType;
  private Boolean receivedAtShop;
  private Boolean isExchangeOrder;
  private Boolean isLivestream;
  private Boolean isLiveShopping;
  private Integer orderSources;
  private String pageId;
  private String accountName;
  private String insertedAt;
  private String updatedAt;
  private String timeAssignSeller;
  private String timeSendPartner;
  private String timeAssignCare;
  private String notePrint;
  private List<String> noteImage;
  private String billEmail;
  private String billFullName;
  private String billPhoneNumber;
  private String conversationId;
  private Boolean customerPayFee;
  private Boolean returnFee;
  private Double feeMarketplace;
  private Double partnerFee;
  private Double transferMoney;
  private Integer levaPoint;
  private Boolean isSmc;
  private PrepaidByPoint prepaidByPoint;
  private Object advancedPlatformFee;
  private List<String> tags;
  private List<String> customerNeeds;
  private List<OrderItem> items;
  private CustomerDTO customer;
  private UserDTO creator;
  private UserDTO assigningSeller;
  private WarehouseInfo warehouseInfo;
  private ShippingAddress shippingAddress;
  private List<StatusHistory> statusHistory;
  private PageInfo page;

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class OrderItem {
    private Long id;
    private Integer quantity;
    private Double totalDiscount;
    private Double discountEachProduct;
    private Boolean isBonusProduct;
    private String note;
    private VariationInfo variationInfo;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class VariationInfo {
    private String name;
    private BigDecimal retailPrice;
    private Long exactPrice;
    private String barcode;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class CustomerDTO {
    private String id;
    private String name;
    private String phoneNumber;
    private String email;
    private Double currentDebts;
    private Integer orderCount;
    private Boolean isBlock;
    private String referralCode;
    private List<CustomerAddress> shopCustomerAddresses;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class CustomerAddress {
    private String fullAddress;
    private String phoneNumber;
    private String fullName;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class PrepaidByPoint {
    private Long point;
    private Long money;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class UserDTO {
    private String id;
    private String name;
    private String email;
    private String fbId;
    private String avatarUrl;
    private String phoneNumber;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class WarehouseInfo {
    private String address;
    private String affiliateId;
    private String communeId;
    private String customId;
    private String districtId;
    private String ffmId;
    private String fullAddress;
    private Boolean hasSnappyService;
    private String name;
    private String phoneNumber;
    private String postcode;
    private String provinceId;
    private String settings;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class ShippingAddress { //receiver
    private String address;
    private String commnueName;
    private String communeCodeSicepat;
    private String communeId; //wardId
    private String countryCode;
    private String districtId; //districtId
    private String districtName;
    private String fullAddress;
    private String fullName;
    private String marketplaceAddress;
    private String phoneNumber;
    private String postCode;
    private String provinceId; //provinceId
    private String provinceName;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class StatusHistory {
    private String status;
    private String updatedAt;
    private UserDTO editor;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class PageInfo {
    private String id;
    private String name;
    private String username;
  }
}
