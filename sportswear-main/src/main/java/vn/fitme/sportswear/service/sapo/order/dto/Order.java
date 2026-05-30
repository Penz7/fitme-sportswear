package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Order {
  Long id;
  Long tenantId;
  Long locationId;
  String code;
  String createdOn;
  String modifiedOn;
  String issuedOn;
  Long shipOn;
  Long shipOnMin;
  Long shipOnMax;
  Long accountId;
  Long assigneeId;
  Long customerId;
  CustomerData customerData;
  Long contactId;
  Address billingAddress;
  Address shippingAddress;
  String email;
  String phoneNumber;
  String referenceNumber;
  Long priceListId;
  String taxTreatment;
  String status;
  String printStatus;
  String packedStatus;
  String fulfillmentStatus;
  String receivedStatus;
  String paymentStatus;
  String returnStatus;
  Long sourceId;
  Double total;
  Double orderDiscountRate;
  Double orderDiscountValue;
  Double orderDiscountAmount;
  String discountReason;
  Double totalDiscount;
  Double totalTax;
  String note;
  List<String> tags;
  DeliveryFee deliveryFee;
  List<OrderLineItem> orderLineItems;
  String finalizedOn;
  String channel;
  String referenceUrl;
  String einvoiceStatus;
  // create or update

  String sourceName;
  Boolean createInvoice;
  List<DiscountItem> discountItems;
  String expectedDeliveryType;
  List<Fulfillment> fulfillments;
  String couponCode;
  List<PromotionRedemption> promotionRedemptions;
  String operationSystem;
}
