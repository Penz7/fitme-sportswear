package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@NoArgsConstructor
@AllArgsConstructor
public class CustomerData {
  Long id;
  Long tenantId;
  String createdOn;
  String modifiedOn;
  String code;
  String name;
  String groupName;
  List<String> tags;
  List<Address> addresses;
}
