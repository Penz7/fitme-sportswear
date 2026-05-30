package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Item {
  private Long addedToCartQuantity;
  private List<Object> components;
  private String compositeItemId;
  private BigDecimal discountEachProduct;
  private Long exchangeCount;
  private Long id;
  private Boolean isBonusProduct;
  private Boolean isComposite;
  private Boolean isDiscountPercent;
  private Boolean isWholesale;
  private String measureGroupId;
  private String note;
  private Boolean oneTimeProduct;
  private String productId;
  private Integer quantity;
  private Long returnQuantity;
  private Long returnedCount;
  private Long returningQuantity;
  private Long totalDiscount;
  private String variationId;
  private VariationInfo variationInfo;
  private List<Tag> tags;
  private Partner partner;
}
