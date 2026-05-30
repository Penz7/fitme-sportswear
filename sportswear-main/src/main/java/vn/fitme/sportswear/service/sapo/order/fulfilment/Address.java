package vn.fitme.sportswear.service.sapo.order.fulfilment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Address {
    private Long id;
    private String label;
    private String firstName;
    private String lastName;
    private String fullName;
    private String address1;
    private String address2;
    private String email;
    private String phoneNumber;
    private String country;
    private String city;
    private String district;
    private String ward;
    private String zipCode;
    private String fullAddress;
}
