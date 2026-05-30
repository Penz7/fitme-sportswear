package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Data


@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Shipment {
  private Long deliveryFee;
  private Long codAmount;
  private Long weight;
  private Long width;
  private Long height;
  private Long length;
  private String operationSystem;
  private Long deliveryServiceProviderId;
  private Long freightAmount;
  private String detail;
  private String freightPayer;
}
