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
public class PromotionAdvanceInfo {
  private String id;
  private String creatorId;
  private Integer displayId;
  private List<String> discountByCustomerLevels;
  private Boolean isActivated;
  private Boolean isFreeShipping;
  private String name;
  private String type;
  private LocalDateTime endTime;
  private LocalDateTime startTime;
  private Long startPrice;
  private Long endPrice;
  private List<String> items;
  private CouponInfo couponInfo;
  private LocalDateTime insertedAt;
  private Long usedCount;
  private LocalDateTime updatedAt;
  private List<String> warehouseIds;
  private Integer priorityLevel;
  private String groupName;
}
