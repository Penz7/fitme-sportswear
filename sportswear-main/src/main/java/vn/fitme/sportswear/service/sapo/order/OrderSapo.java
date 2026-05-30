package vn.fitme.sportswear.service.sapo.order;

import static vn.fitme.sportswear.constant.SapoConstant.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.SapoApi;
import vn.fitme.sportswear.constant.enums.OrderStatusSapo;
import vn.fitme.sportswear.service.sapo.order.dto.Fulfillment;
import vn.fitme.sportswear.service.sapo.order.dto.FulfillmentData;
import vn.fitme.sportswear.service.sapo.order.fulfilment.FulfillmentRequest;
import vn.fitme.sportswear.service.sapo.order.request.OrderData;
import vn.fitme.sportswear.service.sapo.order.dto.PrepaymentData;
import vn.fitme.sportswear.service.sapo.order.response.OrderResponse;
import vn.fitme.sportswear.util.JsonUtils;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderSapo {
  private final SapoApi sapoApi;

  // Danh sách đơn hàng
  public OrderResponse fetchOrders(
      int page, int limit, List<OrderStatusSapo> statuses, String prefixName) {
    UriComponentsBuilder uriComponentsBuilder =
        UriComponentsBuilder.fromUriString(ORDER_URL)
            .queryParam(PAGE, page)
            .queryParam(LIMIT, limit)
            .queryParam(QUERY, prefixName);
    statuses.forEach(status -> uriComponentsBuilder.queryParam(status.getKey(), status.getValue()));

    return sapoApi.exchange(
        uriComponentsBuilder.toUriString(), HttpMethod.GET, null, OrderResponse.class);
  }

  public OrderResponse fetchOrders(List<String> orderIds) {
    UriComponentsBuilder uriComponentsBuilder =
        UriComponentsBuilder.fromUriString(ORDER_URL).queryParam("ids", orderIds);

    return sapoApi.exchange(
        uriComponentsBuilder.toUriString(), HttpMethod.GET, null, OrderResponse.class);
  }

  // Lấy thông tin 1 đơn hàng
  public OrderData fetchOrderById(String orderId) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/orders/{orderId}.json")
            .buildAndExpand(orderId)
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, OrderData.class);
  }

  // Tạo 1  đơn hàng
  public OrderData createOrder(OrderData orderData) {
    String url = UriComponentsBuilder.fromUriString(ORDER_URL).toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<OrderData> requestEntity = new HttpEntity<>(orderData, headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, OrderData.class);
  }

  //  Cập nhật thông tin 1 đơn hàng
  public OrderData updateOrder(String orderId, OrderData orderData) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/orders/{orderId}.json")
            .buildAndExpand(orderId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<OrderData> requestEntity = new HttpEntity<>(orderData, headers);
    return sapoApi.exchange(url, HttpMethod.PUT, requestEntity, OrderData.class);
  }

  // Duyệt 1  đơn hàng
  public OrderData finalizeOrder(String orderId) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/orders/{orderId}/finalize.json")
            .buildAndExpand(orderId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<String> requestEntity = new HttpEntity<>("{}", headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, OrderData.class);
  }

  // Thanh toán 1  đơn hàng
  public Object prepaymentsOrder(String orderId, PrepaymentData prepaymentData) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/orders/{orderId}/prepayments.json")
            .buildAndExpand(orderId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<PrepaymentData> requestEntity = new HttpEntity<>(prepaymentData, headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
  }

  // Đóng gói 1  đơn hàng
  public Object fulfillmentOrder(FulfillmentRequest fulfillmentRequest, String orderId) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/orders/{orderId}/fulfillments.json")
            .buildAndExpand(orderId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<FulfillmentRequest> requestEntity = new HttpEntity<>(fulfillmentRequest, headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
  }

  // Hủy đóng gói 1  đơn hàng
  public void cancelFulfillmentOrder(String orderId, String fulfillmentId) {

    String url =
        UriComponentsBuilder.fromUriString(
                "/admin/orders/{orderId}/fulfillments/{fulfillmentId}/cancel.json")
            .buildAndExpand(orderId, fulfillmentId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<String> requestEntity = new HttpEntity<>("{}", headers);
    sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
  }

  // Xuất kho 1 đơn hàng
  public Object deliveryOrder(String orderId, String fulfillmentId) {
    String url =
        UriComponentsBuilder.fromUriString(
                "/admin/orders/{orderId}/fulfillments/{fulfillmentId}/ship.json")
            .buildAndExpand(orderId, fulfillmentId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<String> requestEntity = new HttpEntity<>("{}", headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
  }

  // Hủy Xuất kho 1 đơn hàng
  public void cancelDeliveryOrder(String orderId, String fulfillmentId) {
    OrderData orderData = fetchOrderById(orderId);
    if (orderData.getOrder().getFulfillments().isEmpty()) {
      return;
    }
    Fulfillment fulfillment = orderData.getOrder().getFulfillments().getLast();
    fulfillment.setStatus("cancelling");
    fulfillment.setCompositeFulfillmentStatus("fulfilled_cancelling");
    fulfillment.setStatusBeforeCancellation("fulfilled");
    fulfillment.setPushingStatus("cancelled_pushed");
    FulfillmentData req = new FulfillmentData(fulfillment);
    log.info("[cancelDeliveryOrder] req: {}", JsonUtils.toJson(req));
    String url =
        UriComponentsBuilder.fromUriString(
                "/admin/orders/{orderId}/fulfillments/{fulfillmentId}/cancel.json")
            .buildAndExpand(orderId, fulfillmentId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<FulfillmentData> requestEntity = new HttpEntity<>(req, headers);
    Object ok = sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
    log.info("[cancelDeliveryOrder] res: {}", JsonUtils.toJson(ok));
  }

  // Nhận hang sau khi Hủy Xuất kho 1 đơn hàng
  public void receiveAfterCancellation(String orderId, String fulfillmentId) {
    OrderData orderData = fetchOrderById(orderId);
    if (orderData.getOrder().getFulfillments().isEmpty()) {
      return;
    }
    Fulfillment fulfillment = orderData.getOrder().getFulfillments().getLast();
    fulfillment.setStatus("cancelled");
    fulfillment.setCompositeFulfillmentStatus("fulfilled_cancelled");
    fulfillment.setStatusBeforeCancellation("fulfilled");
    fulfillment.setPushingStatus("completed");

    FulfillmentData req = new FulfillmentData(fulfillment);
    log.info("[receiveAfterCancellation] req: {}", JsonUtils.toJson(req));

    String url =
        UriComponentsBuilder.fromUriString(
                "/admin/orders/{orderId}/fulfillments/{fulfillmentId}/receive_after_cancellation.json")
            .buildAndExpand(orderId, fulfillmentId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<FulfillmentData> requestEntity = new HttpEntity<>(req, headers);
    Object ok = sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
    log.info("[receiveAfterCancellation] res: {}", JsonUtils.toJson(ok));
  }

  // Hủy 1  đơn hàng
  public Object cancelOrder(String orderId) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/orders/{orderId}/cancel.json")
            .buildAndExpand(orderId)
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");
    HttpEntity<String> requestEntity = new HttpEntity<>("0", headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, Object.class);
  }

  // https://fitme-sportswear.mysapogo.com/admin/shipping_services/v3/vtp/price.json?
  // sender_province_id=2&
  // sender_district_id=55&receiver_province_id=1&
  // receiver_district_id=688&package_type=HH&
  // package_height=10&package_width=10&package_length=10&package_value=0
  // &cod_amount=30000
  // &service_extra=&service=VSL7&package_weight=100
  // &receiver_province_name=&
  // receiver_district_name=&
  // receiver_ward_name=&
  // freight_payer=shop&
  // shipping_account_id=604003_1
  public Long getFreightAmount(
      Integer senderProvinceId,
      Integer senderDistrictId,
      Integer receiverProvinceId,
      Integer receiverDistrictId,
      Long codAmount,
      String freightPayer) {
    String url =
        UriComponentsBuilder.fromUriString("/admin/shipping_services/v3/vtp/price.json")
            .queryParam("sender_province_id", senderProvinceId)
            .queryParam("sender_district_id", senderDistrictId)
            .queryParam("receiver_province_id", receiverProvinceId)
            .queryParam("receiver_district_id", receiverDistrictId)
            .queryParam("package_type", "HH")
            .queryParam("package_height", 10)
            .queryParam("package_width", 10)
            .queryParam("package_length", 10)
            .queryParam("package_value", 0)
            .queryParam("cod_amount", codAmount)
            .queryParam("service_extra", "")
            .queryParam("service", "VSL7")
            .queryParam("package_weight", 300)
            .queryParam("receiver_province_name", "")
            .queryParam("receiver_district_name", "")
            .queryParam("receiver_ward_name", "")
            .queryParam("freight_payer", freightPayer)
            .queryParam("shipping_account_id", "604003_1")
            .toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.set("X-Sapo-LocationId", "572310");

    HttpEntity<String> requestEntity = new HttpEntity<>("{}", headers);
    Object data = sapoApi.exchange(url, HttpMethod.GET, requestEntity, Object.class);
    if (data instanceof Map<?, ?> map) {
      Object vtpPriceObj = map.get("vtp_price");

      if (vtpPriceObj instanceof Map<?, ?> vtpPriceMap) {
        Object moneyTotalObj = vtpPriceMap.get("money_total");

        if (moneyTotalObj instanceof Number number) {
          return number.longValue();
        }
      }
    }
    return null;
  }
}
