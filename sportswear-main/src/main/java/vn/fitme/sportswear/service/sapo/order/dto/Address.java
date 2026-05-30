package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Address {
  Long id;
  String createdOn;
  String modifiedOn;
  String country;
  String city;
  String district;
  String ward;
  String address1;
  String address2;
  String zipCode;
  String fullName;
  String label;
  String phoneNumber;
  String status;
}
