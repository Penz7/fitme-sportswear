package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShippingAddress {
    private String address;
    private String communeId;
    private String countryCode;
    private String districtId;
    private String fullAddress;
    private String fullName;
    private String phoneNumber;
    private String postCode;
    private String provinceId;
}
