package vn.fitme.sportswear.service.sapo.product;

import static vn.fitme.sportswear.constant.SapoConstant.*;

import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.SapoApi;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;
import vn.fitme.sportswear.service.sapo.product.request.ProductWrapper;
import vn.fitme.sportswear.service.sapo.product.request.PurchaseOrderResponse;
import vn.fitme.sportswear.service.sapo.product.response.ProductResponse;

@Service
@RequiredArgsConstructor
public class ProductSapo {
  private final SapoApi sapoApi;

  // Danh sách sản phẩm
  public ProductResponse fetchProducts(int page, int limit) {
    String url =
        UriComponentsBuilder.fromUriString(PRODUCT_SEARCH_URL)
            .queryParam(PAGE, page)
            .queryParam(LIMIT, limit)
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, ProductResponse.class);
  }

  // Danh sách nhập hàng đã hoàn thành
  public PurchaseOrderResponse fetchPurchaseOrders(int page, int limit) {
    // https://fitme-sportswear.mysapogo.com/admin/purchase_orders.json?page=1&limit=20&statuses=completed
    String url =
        UriComponentsBuilder.fromUriString(PURCHASE_ORDER_URL)
            .queryParam(PAGE, page)
            .queryParam(LIMIT, limit)
            .queryParam("statuses", "completed")
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, PurchaseOrderResponse.class);
  }

  public Object createProduct(ProductWrapper productWrapper) {
    String url = UriComponentsBuilder.fromUriString(PRODUCT_URL).toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    HttpEntity<ProductWrapper> requestEntity = new HttpEntity<>(productWrapper, headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
  }

}
