package vn.fitme.sportswear.service.sapo.address.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
public class City {
    private int id;
    private String name;
    private String nameTransliteration;
    private String alias;
    private Boolean isActive;
    private Boolean isBigCity;
    private int regionalId;
    private int countryId;
    private int number;
}