package vn.fitme.sportswear.service.pancake.order;

import static vn.fitme.sportswear.constant.PancakeConstant.PAGE_NUMBER;
import static vn.fitme.sportswear.constant.PancakeConstant.PAGE_SIZE;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.PancakeApi;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;
import vn.fitme.sportswear.service.pancake.order.response.OrderDetailResponse;
import vn.fitme.sportswear.service.pancake.order.response.OrderListResponse;
import vn.fitme.sportswear.util.PancakeStaticUtil;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderPancake {
  private final PancakeApi pancakeApi;

  // Danh sách đơn hàng
  public OrderListResponse fetchOrders(Long pageSize, Long pageNumber) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/orders")
            .queryParam(PAGE_SIZE, pageSize)
            .queryParam(PAGE_NUMBER, pageNumber)
            .buildAndExpand(PancakeStaticUtil.shopId)
            .toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }

  // Lấy thông tin 1 đơn hàng
  public OrderDetailResponse fetchOrderById(String orderId) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/orders/{orderId}")
            .buildAndExpand(PancakeStaticUtil.shopId, orderId)
            .toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }

  // Tạo 1 đơn hàng
  public OrderDetailResponse createOrder(OrderData orderData) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/orders")
            .buildAndExpand(PancakeStaticUtil.shopId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<OrderData> requestEntity = new HttpEntity<>(orderData, headers);
    return pancakeApi.exchange(
        url, HttpMethod.POST, requestEntity, new ParameterizedTypeReference<>() {});
  }

  // Cập nhật 1 đơn hàng
  public OrderDetailResponse updateOrder(OrderData orderData, String orderId) {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/orders/{orderId}")
            .buildAndExpand(PancakeStaticUtil.shopId, orderId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<OrderData> requestEntity = new HttpEntity<>(orderData, headers);
    return pancakeApi.exchange(
        url, HttpMethod.PUT, requestEntity, new ParameterizedTypeReference<>() {});
  }

  // Danh sách đơn hàng đổi trả
  public OrderListResponse fetchOrderReturned(Long pageSize, Long pageNumber) {
    String url =
        UriComponentsBuilder.fromUriString("/orders_returned")
            .queryParam(PAGE_SIZE, pageSize)
            .queryParam(PAGE_NUMBER, pageNumber)
            .toUriString();
    return pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
  }
}
