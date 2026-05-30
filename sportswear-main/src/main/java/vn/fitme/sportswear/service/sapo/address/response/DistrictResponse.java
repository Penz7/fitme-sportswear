package vn.fitme.sportswear.service.sapo.address.response;

import vn.fitme.sportswear.service.sapo.address.dto.District;

import lombok.Data;
import java.util.List;

@Data
public class DistrictResponse {
  private Boolean success;
  private List<District> districts;
}
