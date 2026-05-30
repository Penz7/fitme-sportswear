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
public class LineItem {
  private String id;
  private String adminGraphqlApiId;
  private List<AttributedStaff> attributedStaffs;
  private Integer currentQuantity;
  private Integer fulfillableQuantity;
  private String fulfillmentService;
  private Boolean giftCard;
  private Integer grams;
  private String name;
  private String price;
  private MoneySet priceSet;
  private Boolean productExists;
  private Long productId;
  private Integer quantity;
  private Boolean requiresShipping;
  private String sku;
  private Boolean taxable;
  private String title;
  private String totalDiscount;
  private MoneySet totalDiscountSet;
  private Long variantId;
  private String variantInventoryManagement;
  private String variantTitle;
  private String vendor;
  private List<Object> taxLines;
  private List<Object> duties;
  private List<Object> discountAllocations;
}
