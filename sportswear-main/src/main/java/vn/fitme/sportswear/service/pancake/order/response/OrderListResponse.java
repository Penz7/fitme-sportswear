package vn.fitme.sportswear.service.pancake.order.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.pancake.order.dto.*;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderListResponse {
  private List<ActivatedComboProduct> activatedComboProducts;
  private List<ActivatedPromotionAdvance> activatedPromotionAdvances;
  private Aggregations aggs;
  private List<OrderData> data;
  private Long pageNumber;
  private Long pageSize;
  private Boolean success;
  private Long totalEntries;
  private Long totalPages;
}
