package vn.fitme.sportswear.service.sapo.product.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.Getter;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@Getter
public class Product {
  private Long id;
  private Long tenantId;
  private String createdOn;
  private String modifiedOn;
  private String status;
  private Long brandId;
  private String brand;
  private String description;
  private String imagePath;
  private String imageName;
  private String name;
  private String opt1;
  private String opt2;
  private String opt3;
  private String category;
  private String categoryCode;
  private String tags;
  private Boolean medicine;
  private String productType;
  private List<Variant> variants;
  private List<Option> options;
  private List<Image> images;
}
