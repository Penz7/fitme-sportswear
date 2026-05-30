package vn.fitme.sportswear.service.pancake.product.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.product.request.Product;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductData {
    private String barcode;
    private String displayId;
    private Boolean hidden;
    private Boolean locked;
    private Boolean sellNegativeVariation;
    private List<Field> fields;
    private String id;
    private List<String> images;
    private String insertedAt;
    private Integer lastImportedPrice;
    private Integer priceAtCounter;
    private String productId;
    private Product product;
    private Integer remainQuantity;
    private Integer retailPrice;
    private Integer totalPurchasePrice;
    private List<VariationWarehouse> variationsWarehouses;
    private List<Integer> wholesalePrice;
}
