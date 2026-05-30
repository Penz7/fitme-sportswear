package vn.fitme.sportswear.service.sapo.order.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.dto.Metadata;

import java.util.List;

@Data


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OrderResponse {
  Metadata metadata;
  List<Order> orders;
  Double ordersTotalAmount;
  Double ordersPaidAmount;
  Double shipmentsCodAmount;
  Double orderReturnAmount;
}
