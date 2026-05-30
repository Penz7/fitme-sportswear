package vn.fitme.sportswear.service.sapo.order.fulfilment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Shipment {
    private Long deliveryServiceProviderId;
    private String detail; // Nếu muốn parse thêm thì tạo class ShipmentDetail
    private String freightPayer;
    private Long freightAmount;
    private Long deliveryFee;
    private Long codAmount;
    private int weight;
    private int width;
    private int height;
    private int length;
    private String operationSystem;
    private String shippingAccountId;
}
