package vn.fitme.sportswear.service;

import static vn.fitme.sportswear.constant.AppConstant.*;

import java.util.*;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.repository.entity.*;
import vn.fitme.sportswear.service.pancake.PancakeService;
import vn.fitme.sportswear.service.pancake.address.dto.Province;
import vn.fitme.sportswear.service.pancake.address.response.ProvinceResponse;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.address.dto.City;
import vn.fitme.sportswear.service.sapo.address.dto.District;
import vn.fitme.sportswear.service.sapo.address.dto.Ward;
import vn.fitme.sportswear.service.sapo.address.response.CityResponse;
import vn.fitme.sportswear.service.sapo.address.response.DistrictResponse;
import vn.fitme.sportswear.service.sapo.address.response.WardResponse;
import vn.fitme.sportswear.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Getter
public class BusinessAddressService {
  @Value("${app.config.enable-create-order-in-pancake:false}")
  private boolean enableCreateOrderInPancake;

  @Value("${app.config.enable-sync-address:false}")
  private boolean enableSyncAddress;

  private final PancakeService pancakeService;
  private final SapoService sapoService;
  private final DynamicTableManagerUtil manager;

  public void syncAddress() throws Exception {
    if (!enableSyncAddress) return;
    CityResponse cities = sapoService.getAddressSapo().fetchCities();
    ProvinceResponse provinces = pancakeService.getAddressPancake().fetchProvinces();
    List<MatchResult<City, Province>> match =
        MatcherUtil.match(
            cities.getCities(),
            provinces.getData(),
            (c, p) -> HelperUtil.calculateSimilarity(c.getName(), p.getName()));
    manager.dropTableIfExists("test_webhook_logs");
    manager.createTableIfNotExists(PROVINCE_MAPPING, City.class, Province.class);
    manager.deleteAllFromTable(PROVINCE_MAPPING);
    match.forEach(
        element -> {
          try {
            manager.save(PROVINCE_MAPPING, element);
          } catch (Exception e) {
            throw new RuntimeException(e);
          }
        });
    // xu ly district_mapping
    List<Map<String, Object>> cityProvinceMapping = manager.findAll(PROVINCE_MAPPING);
    manager.createTableIfNotExists(
        DISTRICT_MAPPING,
        District.class,
        vn.fitme.sportswear.service.pancake.address.dto.District.class);
    manager.deleteAllFromTable(DISTRICT_MAPPING);
    cityProvinceMapping.forEach(
        row -> {
          DistrictResponse districtResponse =
              sapoService
                  .getAddressSapo()
                  .fetchDistrictsByCityId(Integer.valueOf(row.get(SAPO_ID).toString()));
          List<District> districts = districtResponse.getDistricts();
          vn.fitme.sportswear.service.pancake.address.response.DistrictResponse districtResponse1 =
              pancakeService
                  .getAddressPancake()
                  .fetchDistrictsByProvinceId(Integer.valueOf(row.get(PANCAKE_ID).toString()));
          List<vn.fitme.sportswear.service.pancake.address.dto.District> districts1 =
              districtResponse1.getData();
          List<MatchResult<District, vn.fitme.sportswear.service.pancake.address.dto.District>>
              matchDistrict =
                  MatcherUtil.match(
                      districts,
                      districts1,
                      (c, p) -> HelperUtil.calculateSimilarity(c.getName(), p.getName()));
          matchDistrict.forEach(
              element -> {
                try {
                  manager.save(DISTRICT_MAPPING, element);
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });
          System.out.println("Row:");
          row.forEach((col, val) -> System.out.println("  " + col + " = " + val));
        });
    // xu ly ward_mapping
    List<Map<String, Object>> districtMapping = manager.findAll(DISTRICT_MAPPING);
    manager.createTableIfNotExists(
        WARD_MAPPING, Ward.class, vn.fitme.sportswear.service.pancake.address.dto.Ward.class);
    manager.deleteAllFromTable(WARD_MAPPING);
    districtMapping.forEach(
        row -> {
          WardResponse wardResponse =
              sapoService
                  .getAddressSapo()
                  .fetchWardsByDistrictId(Integer.valueOf(row.get(SAPO_ID).toString()));
          List<Ward> wards = wardResponse.getWards();
          vn.fitme.sportswear.service.pancake.address.response.WardResponse wardResponse1 =
              pancakeService
                  .getAddressPancake()
                  .fetchCommunesByDistrictId(Integer.valueOf(row.get(PANCAKE_ID).toString()));
          List<vn.fitme.sportswear.service.pancake.address.dto.Ward> wards1 =
              wardResponse1.getData();
          List<MatchResult<Ward, vn.fitme.sportswear.service.pancake.address.dto.Ward>> matchWard =
              MatcherUtil.match(
                  wards,
                  wards1,
                  (c, p) -> HelperUtil.calculateSimilarity(c.getName(), p.getName()));
          matchWard.forEach(
              element -> {
                try {
                  manager.save(WARD_MAPPING, element);
                } catch (Exception e) {
                  throw new RuntimeException(e);
                }
              });
          System.out.println("Row:");
          row.forEach((col, val) -> System.out.println("  " + col + " = " + val));
        });
  }
}
