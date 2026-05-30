package vn.fitme.sportswear.controller.test;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.dto.PrepaymentData;
import vn.fitme.sportswear.service.sapo.order.request.OrderData;
import vn.fitme.sportswear.service.sapo.order.response.OrderResponse;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/sapo")
@RequiredArgsConstructor
public class TestSapoOrderController {

  private final SapoService sapoService;

  @GetMapping("/fetchOrders/{page}/{limit}")
  public ResponseEntity<OrderResponse> fetchOrders(
      @PathVariable Integer page, @PathVariable Integer limit) {
    return ResponseEntity.ok(sapoService.getOrderSapo().fetchOrders(page, limit, null, "AUTO_PANCAKE"));
  }

  @GetMapping("/fetchOrderById/{id}")
  public ResponseEntity<OrderData> fetchOrderById(@PathVariable String id) {
    return ResponseEntity.ok(sapoService.getOrderSapo().fetchOrderById(id));
  }

  @GetMapping("/createOrder")
  public ResponseEntity<OrderData> createOrder() {
    OrderResponse orderResponse = sapoService.getOrderSapo().fetchOrders(1, 1, null, "AUTO_PANCAKE");
    Order order = orderResponse.getOrders().getFirst();
    order.setCode("Test Order");
    OrderData orderData = new OrderData(order);
    return ResponseEntity.ok(sapoService.getOrderSapo().createOrder(orderData));
  }

  @GetMapping("/cancelOrder/{orderId}")
  public ResponseEntity<Object> cancelOrder(@PathVariable String orderId) {
    Object orderResponse = sapoService.getOrderSapo().cancelOrder(orderId);
    return ResponseEntity.ok(orderResponse);
  }

  @GetMapping("/prepaymentsOrder/{orderId}")
  public ResponseEntity<Object> prepaymentsOrder(@PathVariable String orderId) {
    PrepaymentData prepaymentData =
        PrepaymentData.builder()
            .prepayment(
                PrepaymentData.Prepayment.builder()
                    .paymentMethodId(2575663L)
                    .paymentMethodName("Chuyển khoản")
                    .amount(1000000L)
                    .paidAmount(1000000L)
                    .returnedAmount(0L)
                    .paidOn(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss Z"))) // hoặc parse nếu có string
                    .build())
            .build();
    return ResponseEntity.ok(sapoService.getOrderSapo().prepaymentsOrder(orderId, prepaymentData));
  }
}
