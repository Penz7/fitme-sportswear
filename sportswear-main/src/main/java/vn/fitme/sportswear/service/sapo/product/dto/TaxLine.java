package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Data


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TaxLine {
  private String title;
  private Long rate;
  private Long price;
}
