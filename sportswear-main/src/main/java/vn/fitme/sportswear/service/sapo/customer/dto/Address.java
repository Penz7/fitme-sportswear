package vn.fitme.sportswear.service.sapo.customer.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.time.ZonedDateTime;

@Data


@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@NoArgsConstructor
@AllArgsConstructor
public class Address {
    private Long id;
    private String country;
    private String city;
    private String district;
    private String ward;
    private String address1;
    private String address2;
    private String zipCode;
    private String email;
    private String firstName;
    private String lastName;
    private String fullName;
    private String label;
    private String phoneNumber;
    private String status;
}

