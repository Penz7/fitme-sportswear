package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vn.fitme.sportswear.service.sapo.order.fulfilment.Address;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Fulfillment {
  private String id;
  private Long tenantId;
  private Long stockLocationId;
  private String code;
  private Long orderId;
  private Long accountId;
  private Long assigneeId;
  private Long partnerId;
  private Address billingAddress;
  private Address shippingAddress;
  private String deliveryType;
  private String taxTreatment;
  private Double discountRate;
  private Double discountValue;
  private Double discountAmount;
  private Double total;
  private Double totalTax;
  private Double totalDiscount;
  private String notes;
  private String packedOn;
  private String receivedOn;
  private String shippedOn;
  private String cancelDate;
  private Long cancelAccountId;
  private String createdOn;
  private String modifiedOn;
  private String status;
  private Boolean printStatus;
  private String compositeFulfillmentStatus;
  private String paymentStatus;
  private String statusBeforeCancellation;
  private Long stockOutAccountId;
  private Long receiveAccountId;
  private Long receiveCancellationAccountId;
  private String receiveCancellationOn;
  private List<FulfillmentLineItem> fulfillmentLineItems;
  private Shipment shipment;
  private List<Payment> payments;
  private Double totalQuantity;
  private Long reasonCancelId;
  private String pushingStatus;
  private String billOfLadingOn;
  private Long packedProcessingAccountId;
  private Long billOfLadingAccountId;
  private String latePickupDate;
  private String lateDeliveryDate;

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  public static class FulfillmentLineItem {
    private Long id;
    private String createdOn;
    private String modifiedOn;
    private Long orderLineItemId;
    private Long productId;
    private String productName;
    private Long variantId;
    private String variantName;
    private String orderLineItemNote;
    private Boolean isFreeform;
    private Boolean isComposite;
    private Boolean isPacksize;
    private Double basePrice;
    private Double quantity;
    private Long taxTypeId;
    private Double taxRateOverride;
    private Double taxRate;
    private Double lineAmount;
    private Double lineTaxAmount;
    private Double lineDiscountAmount;
    private Double discountValue;
    private Double discountRate;
    private String variant;
    private String sku;
    private String barcode;
    private String unit;
    private String variantOptions;
    private String serials;
    private String lotsDates;
    private String productType;
    private Double distributedDiscountValue;
    private Double distributedDiscountAmount;
    private String lotsNumberCode1;
    private String lotsNumberCode2;
    private String lotsNumberCode3;
    private String lotsNumberCode4;
    private List<Object> subVariants;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  public static class Shipment {
    private Long id;
    private Long deliveryServiceProviderId;
    private String serviceName;
    private Double codAmount;
    private Double freightAmount;
    private String freightAmountDetail;
    private Double deliveryFee;
    private String trackingCode;
    private String trackingUrl;
    private String createdOn;
    private String modifiedOn;
    private String senderAddress;
    private ShippingAddress shippingAddress;
    private List<Object> shipperDeposits;
    private String detail;
    private String note;
    private String pushingStatus;
    private String referenceStatus;
    private String referenceStatusExplanation;
    private String pushingNote;
    private String collationStatus;
    private String deliveryServiceProvider;
    private String partnerOrderId;
    private String freightPayer;
    private String estimatedDeliveryTime;
    private String routeCodeSe;
    private String sortingCode;
    private Boolean isMultipleDropOff;
    private Double weight;
    private Double length;
    private Double height;
    private Double width;
    private String partialTrackingCode;
    private String partialTrackingUrl;
    private String shippingAccountId;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ShippingAddress {
      private Long id;
      private String label;
      private String firstName;
      private String lastName;
      private String fullName;
      private String address1;
      private String address2;
      private String email;
      private String phoneNumber;
      private String country;
      private String city;
      private String district;
      private String ward;
      private String zipCode;
      private String fullAddress;
    }
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  public static class Payment {
    // Thêm các trường cần thiết cho đối tượng Payment nếu có
  }
}
