package vn.fitme.sportswear.service.sapo.customer.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Metadata {
  private Long total;
  private Long page;
  private Long limit;
}
