package vn.fitme.sportswear.service.pancake.product.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductDataResponse {
    private DataWrapper data;
    private Boolean success;

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DataWrapper {
        private String customId;
        private String image;
        private List<String> categoryIds;
        private Integer displayId;
        private LocalDateTime insertedAt;
        private String name;
        private LocalDateTime updatedAt;
        private Boolean isHide;
        private Long shopId;
        private String type;
        private List<String> bonusProducts;
        private UUID creatorId;
        private String note;
        private String brandId;
        private UUID id;
        private List<String> manipulationWarehouses;
        private String shopWarrantyPolicyId;
        private Boolean ignoreAwardedPoint;
        private String keyword;
        private Integer lifecycleDays;
        private List<String> tags;
        private String noteProduct;
        private String warrantyPeriod;
        private String displayIdOriginal;
        private String offlineId;
        private List<String> supplierProductIds;
        private Integer limitQuantityToWarn;
        private List<String> categories;
        private Boolean isSellNegative;
        private List<String> productLinks;
        private Boolean removed;
        private String description;
        private String measureGroupId;
        private Boolean hideProductName;
        private String thirdParties;
        private Boolean warningByVariation;
        private List<String> storeLinks;
        private List<String> materialNames;
        private Boolean isPriceByWeight;
        private List<Variation> variations;
        private Boolean notPrintProduct;
        private Boolean isPublished;
        private String materials;
        private List<String> productAttributes;
    }

    @Data
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Variation {
        private String barcode;
        private List<String> compositeProducts;
        private String displayId;
        private List<String> fields;
        private UUID id;
        private List<String> images;
        private LocalDateTime insertedAt;
        private Boolean isHidden;
        private Boolean isLocked;
        private Boolean isRemoved;
        private Boolean isSellNegativeVariation;
        private Integer lastImportedPrice;
        private Integer priceAtCounter;
        private UUID productId;
        private Integer remainQuantity;
        private Integer retailPrice;
        private Integer retailPriceAfterDiscount;
        private List<String> variationsWarehouses;
        private String videos;
        private Integer weight;
        private List<String> wholesalePrice;
    }
}