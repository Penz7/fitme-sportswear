package vn.fitme.sportswear.service.pancake.product;

import static vn.fitme.sportswear.constant.PancakeConstant.PAGE_NUMBER;
import static vn.fitme.sportswear.constant.PancakeConstant.PAGE_SIZE;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.PancakeApi;
import vn.fitme.sportswear.service.pancake.product.dto.CategoryNode;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.pancake.product.request.WarehouseRequest;
import vn.fitme.sportswear.service.pancake.product.response.ProductDataResponse;
import vn.fitme.sportswear.service.pancake.product.response.CategoryResponse;
import vn.fitme.sportswear.service.pancake.product.response.PagingResponse;
import vn.fitme.sportswear.util.PancakeStaticUtil;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductPancake {
  private final PancakeApi pancakeApi;

  // Danh sách sản phẩm
  public PagingResponse<ProductData> fetchProducts(int pageSize, int pageNumber, String search) {
    UriComponentsBuilder uriComponentsBuilder =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/products/variations")
            .queryParam(PAGE_SIZE, pageSize)
            .queryParam(PAGE_NUMBER, pageNumber);
    if (search != null) {
      uriComponentsBuilder.queryParam("search", search);
    }
    String url = uriComponentsBuilder.buildAndExpand(PancakeStaticUtil.shopId).toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }

  // Tạo sản phẩm
  public ProductDataResponse createProduct(ProductData product) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/products")
            .buildAndExpand(PancakeStaticUtil.shopId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<ProductData> requestEntity = new HttpEntity<>(product, headers);
    return pancakeApi.exchange(
        url, HttpMethod.POST, requestEntity, new ParameterizedTypeReference<>() {});
  }

  // Cập nhật sản phẩm
  public ProductDataResponse updateProduct(String productId, ProductData product) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/products/{productId}")
            .buildAndExpand(PancakeStaticUtil.shopId, productId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<ProductData> requestEntity = new HttpEntity<>(product, headers);
    return pancakeApi.exchange(
        url, HttpMethod.PUT, requestEntity, new ParameterizedTypeReference<>() {});
  }

  // Cập nhật tồn kho
  public Object updateQuantity(String variationId, WarehouseRequest request) {
    String url =
        UriComponentsBuilder.fromUriString(
                "/shops/{shopId}/variations/{variationId}/update_quantity")
            .buildAndExpand(PancakeStaticUtil.shopId, variationId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<WarehouseRequest> requestEntity = new HttpEntity<>(request, headers);
    return pancakeApi.exchange(
        url, HttpMethod.POST, requestEntity, new ParameterizedTypeReference<>() {});
  }

  // Danh sách danh mục
  public CategoryResponse fetchCategories(CategoryNode categoryNode) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/categories")
            .buildAndExpand(PancakeStaticUtil.shopId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<CategoryNode> requestEntity = new HttpEntity<>(categoryNode, headers);
    return pancakeApi.exchange(
        url, HttpMethod.POST, requestEntity, new ParameterizedTypeReference<>() {});
  }
}
