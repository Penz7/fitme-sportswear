package vn.fitme.sportswear.service.pancake.address.response;

import lombok.Data;
import vn.fitme.sportswear.service.pancake.address.dto.District;

import java.util.List;

@Data
public class DistrictResponse {
    private Boolean success;
    private List<District> data;
}
