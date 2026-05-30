package vn.fitme.sportswear.mapper;

import java.time.LocalDateTime;
import java.util.*;

import org.mapstruct.Mapper;
import vn.fitme.sportswear.repository.ShopifyProductRepository;
import vn.fitme.sportswear.service.shopify.model.ShopifyProduct;
import vn.fitme.sportswear.service.shopify_v2.dto.Product;

@Mapper(componentModel = "spring")
public interface ProductShopifyMapper {

  default List<vn.fitme.sportswear.repository.entity.ShopifyProduct> toHistoricalProductV1(
      ShopifyProductRepository shopifyProductRepository,
      ShopifyProduct product,
      Set<String> seenSkus) {

    return product.getVariants().stream()
        .filter(variant -> Objects.nonNull(variant.getSku()) && !variant.getSku().isEmpty())
        .filter(variant -> seenSkus.add(variant.getSku()))
        .map(
            variant -> {
              var shopifyProduct =
                  Optional.ofNullable(shopifyProductRepository.findBySku(variant.getSku()))
                      .orElse(new vn.fitme.sportswear.repository.entity.ShopifyProduct());
              shopifyProduct.setSku(variant.getSku());
              shopifyProduct.setVariantId(variant.getId());
              shopifyProduct.setProductId(product.getId());
              shopifyProduct.setName(product.getTitle() + " - " + variant.getTitle());
              shopifyProduct.setAvailable(variant.getAvailable());
              shopifyProduct.setRemain(variant.getInventoryQuantity());
              shopifyProduct.setRetailPrice(variant.getPrice());
              shopifyProduct.setUpdatedAt(LocalDateTime.now());
              shopifyProduct.setUpdatedBy("SHOPIFY");

              return shopifyProduct;
            })
        .toList();
  }

    default List<vn.fitme.sportswear.repository.entity.ShopifyProduct> toHistoricalProduct(
            ShopifyProductRepository shopifyProductRepository,
            Product product,
            Set<String> seenSkus) {

        return product.getVariants().stream()
                .filter(variant -> Objects.nonNull(variant.getSku()) && !variant.getSku().isEmpty())
                .filter(variant -> seenSkus.add(variant.getSku()))
                .map(
                        variant -> {
                            var shopifyProduct =
                                    Optional.ofNullable(shopifyProductRepository.findBySku(variant.getSku()))
                                            .orElse(new vn.fitme.sportswear.repository.entity.ShopifyProduct());
                            shopifyProduct.setSku(variant.getSku());
                            shopifyProduct.setVariantId(variant.getId());
                            shopifyProduct.setProductId(product.getId());
                            shopifyProduct.setName(product.getTitle() + " - " + variant.getTitle());
                            shopifyProduct.setAvailable(variant.getAvailable());
                            shopifyProduct.setRemain(variant.getInventoryQuantity());
                            shopifyProduct.setRetailPrice(variant.getPrice());
                            shopifyProduct.setUpdatedAt(LocalDateTime.now());
                            shopifyProduct.setUpdatedBy("SHOPIFY");

                            return shopifyProduct;
                        })
                .toList();
    }
}
