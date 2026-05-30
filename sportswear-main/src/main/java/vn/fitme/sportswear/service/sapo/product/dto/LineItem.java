package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import java.util.List;

@Data


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LineItem {
    private long id;
    private long productId;
    private long variantId;
    private String title;
    private String sku;
    private Long quantity;
    private Long price;
    private String appliedDiscount;
    private Long discountAllocation;
    private List<TaxLine> taxLines;
    private Long acceptedQuantity;
    private Long remainingQuantity;
    private String note;
    private String productType;
    private List<String> serials;
    private List<String> lotsDates;
    private Boolean taxIncluded;
    private Long excludedTaxPrice;
    private Long excludedTaxBeginAmount;
    private Long excludedDiscountAllocation;
    private String orderSupplierLineItemId;
    private Boolean packsize;
    private Long packSizeQuantity;
    private String packSizeRootId;
}

