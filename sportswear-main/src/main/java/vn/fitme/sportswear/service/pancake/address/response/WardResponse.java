package vn.fitme.sportswear.service.pancake.address.response;

import lombok.Data;
import vn.fitme.sportswear.service.pancake.address.dto.Ward;

import java.util.List;

@Data
public class WardResponse {
    private Boolean success;
    private List<Ward> data;
}
