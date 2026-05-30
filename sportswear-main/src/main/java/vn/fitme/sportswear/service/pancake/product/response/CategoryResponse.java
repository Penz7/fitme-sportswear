package vn.fitme.sportswear.service.pancake.product.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.product.dto.CategoryNode;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CategoryResponse {
    private List<CategoryNode> data;
    private Boolean success;
}

