package vn.fitme.sportswear.service.sapo.order.fulfilment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class FulfillmentLineItem {
    private Long orderLineItemId;
    private Object serials; // Có thể là List<String> nếu cần cụ thể
    private List<Object> lotsDates;
    private int quantity;
    private String sku;
    private String productName;
    private BigDecimal price;
}
