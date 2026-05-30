package vn.fitme.sportswear.mapper;

import org.mapstruct.Mapper;
import vn.fitme.sportswear.repository.SapoProductRepository;
import vn.fitme.sportswear.repository.entity.SapoProduct;
import vn.fitme.sportswear.service.sapo.product.dto.Variant;
import vn.fitme.sportswear.service.sapo.product.dto.Product;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Mapper(componentModel = "spring")
public interface ProductSapoMapper {

  default List<SapoProduct> toHistoricalProduct(
      SapoProductRepository sapoProductRepository, Product product) {
    return product.getVariants().stream()
        .map(
            variant -> {
              SapoProduct sapoProduct = sapoProductRepository.findBySku(variant.getSku());
              if (Objects.isNull(sapoProduct)) {
                sapoProduct = new SapoProduct();
              }
              sapoProduct.setSku(variant.getSku());
              sapoProduct.setVariantId(variant.getId().toString());
              sapoProduct.setProductId(product.getId().toString());
              sapoProduct.setName(product.getName());
              sapoProduct.setAvailable(sumAvailable(variant));
              sapoProduct.setRemain(sumOnHand(variant));
              sapoProduct.setRetailPrice(variant.getVariantRetailPrice());
              sapoProduct.setUpdatedAt(LocalDateTime.now());
              return sapoProduct;
            })
        .toList();
  }

  private Integer sumAvailable(Variant variant) {
    if (variant == null) return 0;
    return variant.getInventories().stream()
        .mapToInt(i -> i.getAvailable() != null ? i.getAvailable().intValue() : 0)
        .sum();
  }

  private Integer sumOnHand(Variant variant) {
    if (variant == null) return 0;
    return variant.getInventories().stream()
        .mapToInt(i -> i.getOnHand() != null ? i.getOnHand().intValue() : 0)
        .sum();
  }
}
