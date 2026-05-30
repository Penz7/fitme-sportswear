package vn.fitme.sportswear.service.sapo.product.request;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductWrapper {
    private Product product = new Product();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Product {
        private Long initPrice = 0L;
        private Long initStock = 0L;
        private Long retailPrice = 0L;
        private Long orderQuantity = 0L;
        private Long importPrice = 0L;
        private List<Variant> variants = new ArrayList<>();
        private String name;
        private String sku;
        private String unit = "";
        private String productType = "normal";
        private Boolean sellable = true;
        private Boolean taxable = false;
        private Long weightValue = 0L;
        private String weightUnit = "g";
        private Boolean openOption = false;
        private List<Option> options = new ArrayList<>();
        private Long locationId = 0L;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Variant {
        private String id = null;
        private String name = "TEST";
        private String unit = "";
        private String sku = "TEST-SKU";
        private String opt1 = "Mặc định";
        private List<Inventory> inventories = new ArrayList<>();
        private List<VariantPrice> variantPrices = new ArrayList<>();
        private String weightUnit = "g";
        private Long weightValue = 0L;
        private Boolean sellable = true;
        private Boolean taxable = false;
        private Long inputVatId = 1687217L;
        private Long outputVatId = 1687217L;
        private Boolean taxIncluded = true;
        private List<String> packsizes = new ArrayList<>();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Inventory {
        private Long locationId = 572310L;
        private Long initPrice = 0L;
        private Long initStock = 0L;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VariantPrice {
        private int value = 0;
        private int priceListId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Option {
        private String name = "Kích thước";
        private int position = 1;
        private List<String> value = new ArrayList<>();
    }
}

