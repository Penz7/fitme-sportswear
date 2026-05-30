package vn.fitme.sportswear.service.pancake.address;


import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.PancakeApi;
import vn.fitme.sportswear.service.pancake.address.response.DistrictResponse;
import vn.fitme.sportswear.service.pancake.address.response.ProvinceResponse;
import vn.fitme.sportswear.service.pancake.address.response.WardResponse;

@Service
@RequiredArgsConstructor
@Slf4j
public class AddressPancake {
  private final PancakeApi pancakeApi;

  // Lấy danh sách tất cả tỉnh, thành phố
  public ProvinceResponse fetchProvinces() {
    String url = UriComponentsBuilder.fromUriString("/geo/provinces").toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }

  // Lấy danh sách quận huyện của 1 thành phố
  public DistrictResponse fetchDistrictsByProvinceId(Integer provinceId) {
    String url =
        UriComponentsBuilder.fromUriString("/geo/districts")
            .queryParam("province_id", provinceId)
            .toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }

  // Lấy danh sách xã của 1 quận huyện
  public WardResponse fetchCommunesByDistrictId(Integer districtId) {
    String url =
        UriComponentsBuilder.fromUriString("/geo/communes")
            .queryParam("district_id", districtId)
            .toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }
}
