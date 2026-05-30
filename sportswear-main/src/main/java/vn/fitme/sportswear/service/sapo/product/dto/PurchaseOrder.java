package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;


@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PurchaseOrder {
    private Long id;
    private Long tenantId;
    private Long locationId;
    private Long accountId;
    private Long assigneeId;
    private String code;
    private String reference;
    private Long supplierId;
    private SupplierData supplierData;
    private String orderSupplierId;
    private String orderSupplierCode;
    private Address billingAddress;
    private Address supplierAddress;
    private String email;
    private String phoneNumber;
    private List<LineItem> lineItems;
    private String appliedDiscount;
    private List<LandedCostLine> landedCostLines;
    private String note;
    private List<String> tags;
    private Long priceListId;
    private Boolean taxesIncluded;
    private List<TaxLine> taxLines;
    private List<Transaction> transactions;
    private List<Receipt> receipts;
    private List<Refund> refunds;
    private Long totalDiscounts;
    private Long totalLineItemsPrice;
    private Long subtotalPrice;
    private Long totalTax;
    private Long totalLandedCosts;
    private Long totalPrice;
    private String totalRefunds;
    private String status;
    private String financialStatus;
    private String receiveStatus;
    private String paymentStatus;
    private String refundPaymentStatus;
    private String receiveInventoryStatus;
    private String refundStatus;
    private String dueOn;
    private Long activatedAccountId;
    private String cancelledOn;
    private String cancelReason;
    private String cancelledAccountId;
    private String activatedOn;
    private String completedOn;
    private String closedOn;
    private String closedAccountId;
    private String createdOn;
    private String modifiedOn;
    private String interconnectionStatus;
}

