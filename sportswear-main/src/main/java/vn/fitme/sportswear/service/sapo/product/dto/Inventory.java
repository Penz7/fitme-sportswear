package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Inventory {
  private Long locationId;
  private Long variantId;
  private Double mac;
  private Integer amount;
  private Double onHand;
  private Double available;
  private Double committed;
  private Double incoming;
  private Double onway;
  private Double minValue;
  private Double maxValue;
  private String binLocation;
  private Double waitToPack;
  private String modifiedOn;
}
