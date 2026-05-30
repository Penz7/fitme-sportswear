package vn.fitme.sportswear.service.pancake.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CategoryNode {
    private Long id;
    private List<CategoryNode> nodes;
    private String text;
}

