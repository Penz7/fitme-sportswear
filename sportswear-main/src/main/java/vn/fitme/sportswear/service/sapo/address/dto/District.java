package vn.fitme.sportswear.service.sapo.address.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class District {
    private int id;
    private int cityId;
    private String name;
    private String nameTransliteration;
    private int number;
    private String alias;
    private int countryId;
}
