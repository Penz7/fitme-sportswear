package vn.fitme.sportswear.service.sapo.address.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.sapo.address.dto.City;

import java.util.List;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Data
public class CityResponse {
    private List<City> cities;
}
