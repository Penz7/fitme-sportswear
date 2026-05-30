package vn.fitme.sportswear.service.pancake.product.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.product.dto.ProductAttribute;
import vn.fitme.sportswear.service.pancake.product.dto.Variation;
import vn.fitme.sportswear.service.pancake.product.dto.VariationWarehouse;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Product {
    private String name;
    private List<Long> categoryIds;
    private String noteProduct; //Ghi chú sản phẩm
    private List<ProductAttribute> productAttributes; //Thông tin thuộc tính: Màu, Size, ...
    private List<Integer> tags; //Thẻ sản phẩm
    private List<Variation> variations; //Thông tin mẫu mã
    private Long weight;
    private String customId;
    private Boolean isPublished;
    private List<VariationWarehouse> variationsWarehouses; //Thông tin kho hàng
}
