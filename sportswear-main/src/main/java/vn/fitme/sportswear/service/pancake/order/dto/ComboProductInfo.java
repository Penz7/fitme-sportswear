package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ComboProductInfo {
  private List<ComboProductVariation> comboProductVariations;
  private Long discountAmount;
  private Long discountByPercent;
  private String name;
}
