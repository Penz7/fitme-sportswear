package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Data


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Receipt {
    private long id;
    private long accountId;
    private String code;
    private String reference;
    private List<LineItem> lineItems;
    private List<LandedCostLine> landedCostLines;
    private String landedCostAllocationMethod;
    private Long totalLandedCosts;
    private Long totalPrice;
    private String note;
    private String processedOn;
    private String createdOn;
    private long tenantId;
    private long locationId;
    private long purchaseOrderId;
    private String purchaseOrderCode;
    private long supplierId;
}