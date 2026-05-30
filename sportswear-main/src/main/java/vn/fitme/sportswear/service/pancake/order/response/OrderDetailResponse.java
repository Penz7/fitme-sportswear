package vn.fitme.sportswear.service.pancake.order.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.order.dto.*;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderDetailResponse {
  private List<ActivatedComboProduct> activatedComboProducts;
  private List<ActivatedPromotionAdvance> activatedPromotionAdvances;
  private List<Tag> tags;
  private OrderData data;
  private Boolean success;
}
