package vn.fitme.sportswear.service.sapo.customer.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vn.fitme.sportswear.service.sapo.customer.dto.Customer;
import vn.fitme.sportswear.service.sapo.customer.dto.Metadata;

import java.util.List;

@Data


@JsonIgnoreProperties(ignoreUnknown = true)
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CustomerResponse {
  private Metadata metadata;
  private List<Customer> customers;
}
