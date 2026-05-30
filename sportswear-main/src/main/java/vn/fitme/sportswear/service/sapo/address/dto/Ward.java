package vn.fitme.sportswear.service.sapo.address.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Ward {
    private int id;
    private String name;
    private String nameTransliteration;
    private String city;
    private String district;
    private String zipCode;
    private int districtId;
    private int cityId;
}

