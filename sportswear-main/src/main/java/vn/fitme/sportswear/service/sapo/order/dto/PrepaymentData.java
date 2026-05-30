package vn.fitme.sportswear.service.sapo.order.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;
import lombok.ToString;

import java.time.ZonedDateTime;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@ToString
public class PrepaymentData {

  private Prepayment prepayment;

  @Data
  @Builder
  @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
  public static class Prepayment {
    private Long paymentMethodId;
    private String paymentMethodName;
    private Long amount;
    private Long paidAmount;
    private Long returnedAmount;
    private String paidOn;
  }
}
