package vn.fitme.sportswear.service.shopify_v2.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ShippingLine {
  private String id;
  private MoneySet currentDiscountedPriceSet;
  private String discountedPrice;
  private MoneySet discountedPriceSet;
  private Boolean isRemoved;
  private String price;
  private MoneySet priceSet;
  private String source;
  private String title;
  private List<Object> taxLines;
  private List<Object> discountAllocations;
}
