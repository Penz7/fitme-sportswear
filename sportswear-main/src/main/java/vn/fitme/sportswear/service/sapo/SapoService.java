package vn.fitme.sportswear.service.sapo;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.constant.enums.OrderType;
import vn.fitme.sportswear.mapper.ProductSapoMapper;
import vn.fitme.sportswear.repository.SapoProductRepository;
import vn.fitme.sportswear.repository.entity.SapoProduct;
import vn.fitme.sportswear.service.sapo.address.AddressSapo;
import vn.fitme.sportswear.service.sapo.customer.CustomerSapo;
import vn.fitme.sportswear.service.sapo.logs.LogSapo;
import vn.fitme.sportswear.service.sapo.order.OrderSapo;
import vn.fitme.sportswear.service.sapo.order.response.OrderResponse;
import vn.fitme.sportswear.service.sapo.product.ProductSapo;
import vn.fitme.sportswear.service.sapo.product.dto.Product;
import vn.fitme.sportswear.service.sapo.product.response.ProductResponse;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

@Service
@Getter
@RequiredArgsConstructor
@Slf4j
public class SapoService {
  private final AddressSapo addressSapo;
  private final ProductSapo productSapo;
  private final OrderSapo orderSapo;
  private final CustomerSapo customerSapo;
  private final LogSapo logSapo;
  private final SapoProductRepository sapoProductRepository;
  private final SapoProductBatchSaver sapoProductBatchSaver;
  private final ProductSapoMapper productMapper;
  private static final int TOP = 100;
  private static final int PAGE = 1;

  private static final Map<String, Supplier<OrderResponse>> ORDER_FETCHERS =
      new ConcurrentHashMap<>();

  public OrderResponse fetchTopOrdersByType(OrderType type, String prefixName) {
    String key = type.name() + "_" + prefixName;
    return ORDER_FETCHERS
        .computeIfAbsent(key, k -> () -> fetchOrdersByType(type, prefixName))
        .get();
  }

  private OrderResponse fetchOrdersByType(OrderType type, String prefixName) {
    return orderSapo.fetchOrders(PAGE, TOP, type.getSapoStatuses(), prefixName);
  }

  public void saveProductsInDatabase() {
    long now = System.currentTimeMillis();
    int pageNumber = 1;
    int pageSize = 100; // Số lượng sản phẩm mỗi trang
    List<Product> batchProducts;
    List<SapoProduct> db;
    ProductResponse data = null;
    while (true) {
      try {
        data = productSapo.fetchProducts(pageNumber, pageSize);
      } catch (Exception e) {
        log.error("[saveProductsInDatabase] Error fetching products: ", e);
      }
      if (data == null || data.getProducts().isEmpty()) {
        break;
      }
      batchProducts = data.getProducts();
      db =
          batchProducts.stream()
              .flatMap(
                  product ->
                      productMapper.toHistoricalProduct(sapoProductRepository, product).stream())
              .toList();
      try {
        sapoProductBatchSaver.saveBatch(db);
        Thread.sleep(10);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
      } catch (Exception e) {
        log.error("[saveProductsInDatabase] Error saving products: ", e);
      }
      pageNumber++;
    }
    log.info(
        "[saveProductsInDatabase] Save sapo to database success in: {} ms",
        System.currentTimeMillis() - now);
  }
}
