package vn.fitme.sportswear.service.pancake.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@AllArgsConstructor
@NoArgsConstructor
public class VariationWarehouse {
  private Integer remainQuantity; // Số lượng co the ban
  private String warehouseId; // Mã kho hàng
  private Integer actualRemainQuantity; // Số lượng tồn kho
  private Integer pendingQuantity; // Sắp về
  private Integer returningQuantity; // Số lượng đang hoàn
  private Integer totalQuantity; // Tổng số lượng
  private String batchPosition;
  private String shelfPosition;
}
