package vn.fitme.sportswear.service.sapo.customer.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.ZonedDateTime;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Customer {

  private Long id;
  private Long tenantId;
  private Long defaultLocationId;
  private ZonedDateTime createdOn;
  private ZonedDateTime modifiedOn;
  private String code;
  private String name;
  private String dob;
  private String sex;
  private String description;
  private String email;
  private String fax;
  private String phoneNumber;
  private String taxNumber;
  private String website;
  private Long customerGroupId;
  private Long groupId;
  private List<Long> groupIds;
  private String groupName;
  private Long assigneeId;
  private Long defaultPaymentTermId;
  private Long defaultPaymentMethodId;
  private Long defaultTaxTypeId;
  private Double defaultDiscountRate;
  private Long defaultPriceListId;
  private List<String> tags;
  private List<Address> addresses;
  private List<Object> contacts;
  private List<Object> notes;
  private CustomerGroup customerGroup;
  private String status;
  private Boolean isDefault;
  private Integer debt;
  private String applyIncentives;
  private Double totalExpense;
  private Object loyaltyCustomer;
  private SaleOrder saleOrder;
  private List<Object> socialCustomers;

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  public static class CustomerGroup {
    private Long id;
    private Long tenantId;
    private ZonedDateTime createdOn;
    private ZonedDateTime modifiedOn;
    private String name;
    private String nameTranslate;
    private String status;
    private Boolean isDefault;
    private Long defaultPaymentTermId;
    private Long defaultPaymentMethodId;
    private Long defaultTaxTypeId;
    private Double defaultDiscountRate;
    private Long defaultPriceListId;
    private String note;
    private String code;
    private Integer countCustomer;
    private String type;
    private String groupType;
    private String conditionType;
    private Object conditions;
  }

  @Data
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  public static class SaleOrder {
    private Long totalSales;
    private Integer orderPurchases;
    private Integer returnedItemQuantity;
    private Integer netQuantity;
    private ZonedDateTime lastOrderOn;
  }
}
