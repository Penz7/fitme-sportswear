package vn.fitme.sportswear.service.sapo.order.delivery;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class DeliveryInfo {
    private Integer lateDeliveryDays; // dùng Integer để nhận null được
}
