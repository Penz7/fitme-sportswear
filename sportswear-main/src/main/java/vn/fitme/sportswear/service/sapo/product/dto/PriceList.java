package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PriceList {
  private Long id;
  private Long tenantId;
  private String createdOn;
  private String modifiedOn;
  private String code;
  private Long currencyId;
  private String name;
  private Boolean isCost;
  private String currencySymbol;
  private String currencyIso;
  private String status;
  private Boolean init;
}
