package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OrderLineItem {
  Long id;
  String createdOn;
  String modifiedOn;
  String variantId;
  String productId;
  String productName;
  String variantName;
  Boolean taxIncluded;
  Double taxRate;
  Double taxAmount;
  Double discountRate;
  Double discountValue;
  Double discountAmount;
  String note;
  BigDecimal price;
  Integer quantity;
  Boolean isFreeform;
  Double lineAmount;
  String sku;
  String barcode;
  String variantOptions;
  String productType;
}
