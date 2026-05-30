package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Data


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SupplierData {
    private String code;
    private String name;
    private String email;
    private String phoneNumber;
    private String addresses;
}
