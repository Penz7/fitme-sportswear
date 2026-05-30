package vn.fitme.sportswear.service.shopify_v2.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class Address {
  private String firstName;
  private String address1;
  private String phone;
  private String city;
  private String zip;
  private String province;
  private String country;
  private String lastName;
  private String address2;
  private String company;
  private String name;
  private String countryCode;
  private String provinceCode;
}
