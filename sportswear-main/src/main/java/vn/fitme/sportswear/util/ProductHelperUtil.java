package vn.fitme.sportswear.util;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import vn.fitme.sportswear.repository.entity.PancakeProduct;
import vn.fitme.sportswear.repository.entity.SapoProduct;
import vn.fitme.sportswear.repository.entity.ShopifyProduct;
import vn.fitme.sportswear.service.pancake.product.dto.Variation;
import vn.fitme.sportswear.service.pancake.product.request.Product;

public class ProductHelperUtil {

  public static Product getProduct(SapoProduct sapoProduct) {
    Product item = new Product();
    item.setName(sapoProduct.getName());
    item.setCustomId(sapoProduct.getSku());
    item.setCategoryIds(new ArrayList<>()); // phai truyền categoryId
    List<Variation> variations =
        List.of(
            new Variation(
                null,
                null,
                null,
                null,
                (sapoProduct.getRetailPrice() == null)
                    ? null
                    : sapoProduct.getRetailPrice().intValue(),
                null,
                null,
                sapoProduct.getSku(),
                sapoProduct.getSku(),
                false));
    item.setVariations(variations);
    return item;
  }

  public static PancakeProduct getPancakeProduct(
      SapoProduct sapoProduct, String productId, String variationId, String warehouseId) {
    PancakeProduct pancakeProduct = new PancakeProduct();
    pancakeProduct.setName(sapoProduct.getName());
    pancakeProduct.setProductId(productId);
    pancakeProduct.setVariantId(variationId);
    pancakeProduct.setSku(sapoProduct.getSku());
    pancakeProduct.setAvailable(sapoProduct.getRemain());
    pancakeProduct.setRemain(sapoProduct.getRemain());
    pancakeProduct.setRetailPrice(sapoProduct.getRetailPrice());
    pancakeProduct.setWarehouseId(warehouseId);
    pancakeProduct.setUpdatedAt(LocalDateTime.now());
    pancakeProduct.setUpdatedBy("SAPO");
    return pancakeProduct;
  }

  public static ShopifyProduct getShopifyProduct(
          SapoProduct sapoProduct, String productId, String variationId) {
    ShopifyProduct shopifyProduct = new ShopifyProduct();
    shopifyProduct.setName(sapoProduct.getName());
    shopifyProduct.setProductId(productId);
    shopifyProduct.setVariantId(variationId);
    shopifyProduct.setSku(sapoProduct.getSku());
    shopifyProduct.setAvailable(Long.valueOf(sapoProduct.getRemain()));
    shopifyProduct.setRemain(Long.valueOf(sapoProduct.getRemain()));
    shopifyProduct.setRetailPrice(BigDecimal.valueOf(sapoProduct.getRetailPrice()));
    return shopifyProduct;
  }

}
