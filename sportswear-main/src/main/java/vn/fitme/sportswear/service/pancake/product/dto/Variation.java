package vn.fitme.sportswear.service.pancake.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@AllArgsConstructor
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Variation {
    private String id;
    private List<Field> fields; //Thông tin thuộc tính mẫu mã [{name: "Màu", value: "Trắng"}, {name: "Size", value:
    // "M"}]
    private List<String> images; //Link hình ảnh mẫu mã
    private Integer lastImportedPrice; //Giá nhập
    private Integer retailPrice; //Giá sản phẩm
    private Integer priceAtCounter; //Giá bán tại quầy
    private Integer weight; //Khối lượng mẫu mã
    private String barcode; //Mã barcode mẫu mã
    private String customId; //Mã tuỳ chỉnh mẫu mã
    private Boolean isHidden; //Trạng thái StoreCake is_hidden = true -> Ẩn, is_hidden = false -> Hiện
}
