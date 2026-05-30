package vn.fitme.sportswear.service.sapo.order.fulfilment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ShipmentDetail {
    private Long inventoryId;
    private String senderFullName;
    private String senderAddress;
    private String senderPhone;
    private String senderEmail;
    private Integer senderWardId;
    private Integer senderDistrictId;
    private Integer senderProvinceId;
    private String receiverFullName;
    private String receiverAddress;
    private String receiverPhone;
    private String receiverWard;
    private String receiverEmail;
    private Integer receiverDistrictId;
    private Integer receiverProvinceId;
    private String productName;
    private String productDescription;
    private Integer productQuantity;
    private Integer productPrice;
    private Integer productWeight;
    private Integer productLength;
    private Integer productWidth;
    private Integer productHeight;
    private String productType;
    private Integer orderPayment;
    private String orderService;
    private String orderServiceAdd;
    private String orderNote;
    private Long codAmount;
    private String orderVoucher;
    private List<ShipmentItem> listItem;
    private Integer extraMoney;
}

