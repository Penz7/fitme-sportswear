package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Partner {
  private Long cod;
  private String customPartnerId;
  private String extendCode;
  private List<String> extendUpdate;
  private Boolean isReturned;
  private String orderNumberVtp;
  private LocalDateTime paidAt;
  private Long partnerId;
  private String sortCode;
  private Boolean systemCreated;
  private Long totalFee;
  private LocalDateTime updatedAt;
}
