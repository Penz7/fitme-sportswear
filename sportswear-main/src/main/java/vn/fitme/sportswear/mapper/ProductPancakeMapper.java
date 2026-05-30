package vn.fitme.sportswear.mapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.mapstruct.Mapper;
import vn.fitme.sportswear.repository.PancakeProductRepository;
import vn.fitme.sportswear.repository.entity.PancakeProduct;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.pancake.product.dto.VariationWarehouse;

@Mapper(componentModel = "spring")
public interface ProductPancakeMapper {

  default PancakeProduct toHistoricalProduct(
      PancakeProductRepository pancakeProductRepository,
      ProductData product,
      Set<String> seenSkus) {
    if (Objects.isNull(product)
        || Objects.isNull(product.getDisplayId())
        || product.getDisplayId().isEmpty()) {
      return null;
    }
    String sku = product.getDisplayId();
    if (seenSkus.contains(sku)) {
      return null;
    } else {
      seenSkus.add(sku);
    }
    PancakeProduct pancakeProduct = pancakeProductRepository.findBySku(sku);
    if (Objects.isNull(pancakeProduct)) {
      pancakeProduct = new PancakeProduct();
    }
    pancakeProduct.setSku(sku);
    pancakeProduct.setProductId(product.getProductId());
    pancakeProduct.setVariantId(product.getId());
    pancakeProduct.setName(product.getProduct().getName());
    pancakeProduct.setAvailable(
        sumRemainQuantity(product.getVariationsWarehouses())); // Số lượng có thể bán
    pancakeProduct.setRemain(
        sumActualRemainQuantity(product.getVariationsWarehouses())); // Số lượng tồn kho
    pancakeProduct.setRetailPrice(
        product.getRetailPrice() != null ? Double.valueOf(product.getRetailPrice()) : null);
    pancakeProduct.setWarehouseId(
        product.getVariationsWarehouses() != null && !product.getVariationsWarehouses().isEmpty()
            ? product.getVariationsWarehouses().getFirst().getWarehouseId()
            : null); // Mã kho hàng, nếu có

    pancakeProduct.setUpdatedAt(LocalDateTime.now());
    pancakeProduct.setUpdatedBy("PANCAKE");
    return pancakeProduct;
  }

  private Integer sumRemainQuantity(List<VariationWarehouse> variationsWarehouses) {
    if (variationsWarehouses == null) return 0;
    return variationsWarehouses.stream()
        .mapToInt(i -> i.getRemainQuantity() != null ? i.getRemainQuantity() : 0)
        .sum();
  }

  private Integer sumActualRemainQuantity(List<VariationWarehouse> variationsWarehouses) {
    if (variationsWarehouses == null) return 0;
    return variationsWarehouses.stream()
        .mapToInt(i -> i.getActualRemainQuantity() != null ? i.getActualRemainQuantity() : 0)
        .sum();
  }
}
