package vn.fitme.sportswear.service.shopify_v2.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class Order {
  private String id;
  private String adminGraphqlApiId;
  private Boolean buyerAcceptsMarketing;
  private String cancelReason;
  private String cancelledAt;
  private String contactEmail;
  private String createdAt;
  private String currency;
  private MoneySet currentShippingPriceSet;
  private String currentSubtotalPrice;
  private MoneySet currentSubtotalPriceSet;
  private String currentTotalDiscounts;
  private MoneySet currentTotalDiscountsSet;
  private String currentTotalPrice;
  private MoneySet currentTotalPriceSet;
  private String currentTotalTax;
  private MoneySet currentTotalTaxSet;
  private String customerLocale;
  private Boolean dutiesIncluded;
  private String email;
  private Boolean estimatedTaxes;
  private String financialStatus;
  private String name;
  private Integer number;
  private Integer orderNumber;
  private String orderStatusUrl;
  private List<String> paymentGatewayNames;
  private String presentmentCurrency;
  private String processedAt;
  private String sourceName;
  private String subtotalPrice;
  private MoneySet subtotalPriceSet;
  private String tags;
  private Boolean taxExempt;
  private Boolean taxesIncluded;
  private Boolean test;
  private String token;
  private MoneySet totalCashRoundingPaymentAdjustmentSet;
  private MoneySet totalCashRoundingRefundAdjustmentSet;
  private String totalDiscounts;
  private MoneySet totalDiscountsSet;
  private String totalLineItemsPrice;
  private MoneySet totalLineItemsPriceSet;
  private String totalOutstanding;
  private Long totalPrice;
  private MoneySet totalPriceSet;
  private MoneySet totalShippingPriceSet;
  private String totalTax;
  private MoneySet totalTaxSet;
  private String totalTipReceived;
  private int totalWeight;
  private String updatedAt;

  private Address billingAddress;
  private Address shippingAddress;
  private Customer customer;

  private List<DiscountApplication> discountApplications;
  private List<Fulfillment> fulfillments;
  private List<LineItem> lineItems;
  private List<ShippingLine> shippingLines;
  private List<Object> refunds;
  private List<Object> returns;
}
