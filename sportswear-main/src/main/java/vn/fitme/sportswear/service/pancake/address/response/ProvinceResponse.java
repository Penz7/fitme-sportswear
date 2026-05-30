package vn.fitme.sportswear.service.pancake.address.response;

import lombok.Data;
import vn.fitme.sportswear.service.pancake.address.dto.Province;

import java.util.List;

@Data
public class ProvinceResponse {
  private Boolean success;
  private List<Province> data;
}
