package vn.fitme.sportswear.service.pancake.address.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Ward {
    private String id;
    private String name;
    private String nameEn;
    private String postcode;
    private String provinceId;
    private String districtId;
}
