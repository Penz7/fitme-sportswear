package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Variant {
  private Long id;
  private Long tenantId;
  private Long locationId;
  private String createdOn;
  private String modifiedOn;
  private Long categoryId;
  private Long brandId;
  private Long productId;
  private Boolean composite;
  private Double initPrice;
  private Double initStock;
  private Double variantRetailPrice;
  private Double variantWholePrice;
  private Double variantImportPrice;
  private Double costPrice;
  private Long imageId;
  private String description;
  private String name;
  private String opt1;
  private String opt2;
  private String opt3;
  private String productName;
  private String productStatus;
  private String status;
  private Boolean sellable;
  private String sku;
  private String barcode;
  private Boolean taxable;
  private Double weightValue;
  private String weightUnit;
  private String unit;
  private Boolean packsize;
  private Double packsizeQuantity;
  private Long packsizeRootId;
  private String packsizeRootSku;
  private String packsizeRootName;
  private Boolean taxIncluded;
  private Integer inputVatId;
  private Integer outputVatId;
  private Double inputVatRate;
  private Double outputVatRate;
  private String productType;
  private List<VariantPrice> variantPrices;
  private List<Inventory> inventories;
}
