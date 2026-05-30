package vn.fitme.sportswear.service.sapo.order.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vn.fitme.sportswear.service.sapo.order.dto.Order;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@AllArgsConstructor
public class OrderData {
  private Order order;
}
