package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VariationInfo {
  private String barcode;
  private String brandId;
  private List<Long> categoryIds;
  private String detail;
  private String displayId; // "002" => String thay vì int
  private BigDecimal exactPrice;
  private List<Object> fields; // Nếu fields có thể chứa nhiều loại dữ liệu
  private BigDecimal lastImportedPrice;
  private String measureInfo;
  private String name;
  private String productDisplayId; // Nếu ID có thể lớn, dùng long
  private BigDecimal retailPrice;
  private BigDecimal weight;
}
