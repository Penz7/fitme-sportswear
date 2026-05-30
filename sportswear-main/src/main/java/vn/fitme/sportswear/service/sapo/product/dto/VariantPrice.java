package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class VariantPrice {
  private Long id;
  private Double value;
  private Double includedTaxPrice;
  private String name;
  private Long priceListId;
  private PriceList priceList;
}
