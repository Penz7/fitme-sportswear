package vn.fitme.sportswear.service.sapo.address;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.SapoApi;
import vn.fitme.sportswear.service.sapo.address.response.CityResponse;
import vn.fitme.sportswear.service.sapo.address.response.DistrictResponse;
import vn.fitme.sportswear.service.sapo.address.response.WardResponse;

@Service
@RequiredArgsConstructor
public class AddressSapo {
  private final SapoApi sapoApi;

  // Lấy danh sách tất cả tỉnh, thành phố
  public CityResponse fetchCities() {
    String url = UriComponentsBuilder.fromUriString("/admin/cities.json").toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, CityResponse.class);
  }

  // Lấy danh sách quận huyện của 1 thành phố
  public DistrictResponse fetchDistrictsByCityId(Integer cityId) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/countries/201/cities/{cityId}/districts.json")
            .buildAndExpand(cityId)
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, DistrictResponse.class);
  }

  // Lấy danh sách xã của 1 quận huyện
  public WardResponse fetchWardsByDistrictId(Integer districtId) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/districts/{districtId}/wards.json")
            .buildAndExpand(districtId)
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, WardResponse.class);
  }

  // other
  private Object fetchCityById(Integer id) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/countries/201/cities/{id}.json")
            .buildAndExpand(id)
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, Object.class);
  }

  private Object fetchDistricts() {
    String url = UriComponentsBuilder.fromUriString("/admin/districts.json").toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, Object.class);
  }

  private Object fetchDistrictById(Integer id) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/districts/{id}.json")
            .buildAndExpand(id)
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, Object.class);
  }
}
