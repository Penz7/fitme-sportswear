package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ComboProductVariation {
    private Long count;
    private String productId;
    private String variationId;
}
