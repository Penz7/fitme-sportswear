package vn.fitme.sportswear.service.pancake;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.mapper.ProductPancakeMapper;
import vn.fitme.sportswear.repository.PancakeProductRepository;
import vn.fitme.sportswear.repository.entity.PancakeProduct;
import vn.fitme.sportswear.service.pancake.address.AddressPancake;
import vn.fitme.sportswear.service.pancake.product.ProductPancake;
import vn.fitme.sportswear.service.pancake.order.OrderPancake;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.pancake.product.response.PagingResponse;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Getter
@Slf4j
public class PancakeService {
  private final AddressPancake addressPancake;
  private final ProductPancake productPanCake;
  private final OrderPancake orderPancake;
  private final PancakeProductRepository pancakeProductRepository;
  private final PancakeProductBatchSaver pancakeProductBatchSaver;
  private final ProductPancakeMapper productDataMapper;

  public ProductData checkInPancake(String displayId) {
    try {
      return productPanCake.fetchProducts(1, 1, displayId).getData().stream()
          .filter(p -> displayId.equals(p.getDisplayId()))
          .findFirst()
          .orElse(null);
    } catch (Exception e) {
      log.error("[checkInPancake] Error fetching products: ", e);
      return null;
    }
  }

  public void saveProductsInDatabase() {
    long now = System.currentTimeMillis();
    int pageNumber = 1;
    int pageSize = 100;
    PagingResponse<ProductData> data = null;
    List<PancakeProduct> allMapped;
    Set<String> seenSkus = new HashSet<>();
    while (true) {
      try {
        data = productPanCake.fetchProducts(pageSize, pageNumber, null);
      } catch (Exception e) {
        log.error("[saveProductsInDatabase] Error fetching products: ", e);
      }
      if (data == null || data.getData().isEmpty()) {
        break;
      }

      allMapped =
          data.getData().stream()
              .map(
                  productData ->
                      productDataMapper.toHistoricalProduct(
                          pancakeProductRepository, productData, seenSkus))
              .filter(Objects::nonNull)
              .toList();

      try {
        pancakeProductBatchSaver.saveBatch(allMapped);
        Thread.sleep(10);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      } catch (Exception e) {
        log.error("[saveProductsInDatabase] Error saving products: ", e);
      }
      pageNumber++;
    }
    log.info(
        "[saveProductsInDatabase] Save pancake to database success in: {} ms",
        System.currentTimeMillis() - now);
  }
}
