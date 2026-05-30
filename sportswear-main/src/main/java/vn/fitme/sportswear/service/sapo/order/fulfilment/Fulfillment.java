package vn.fitme.sportswear.service.sapo.order.fulfilment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Fulfillment {
  private Address billingAddress;
  private Address shippingAddress;
  private String deliveryType;
  private List<FulfillmentLineItem> fulfillmentLineItems;
  private String notes;
  private Shipment shipment;
  private String operationSystem;
}
