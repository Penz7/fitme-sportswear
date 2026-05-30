package vn.fitme.sportswear.service.pancake.product.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.product.dto.VariationWarehouse;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class WarehouseRequest {
    private List<VariationWarehouse> variationsWarehouses;
}