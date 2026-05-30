package vn.fitme.sportswear.service.sapo.address.response;

import lombok.Data;
import vn.fitme.sportswear.service.sapo.address.dto.Ward;

import java.util.List;

@Data
public class WardResponse {
    private List<Ward> wards;
}
