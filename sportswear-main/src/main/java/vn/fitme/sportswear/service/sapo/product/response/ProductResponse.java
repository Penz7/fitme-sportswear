package vn.fitme.sportswear.service.sapo.product.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vn.fitme.sportswear.service.sapo.product.dto.Metadata;
import vn.fitme.sportswear.service.sapo.product.dto.Product;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductResponse {
  private Metadata metadata;
  private List<Product> products;
}
