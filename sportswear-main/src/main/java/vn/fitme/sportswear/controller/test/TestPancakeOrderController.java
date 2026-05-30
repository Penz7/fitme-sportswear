package vn.fitme.sportswear.controller.test;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.constant.enums.OrderStatusPancake;
import vn.fitme.sportswear.service.pancake.PancakeService;
import vn.fitme.sportswear.service.pancake.order.dto.Item;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;
import vn.fitme.sportswear.service.pancake.order.response.OrderDetailResponse;

@RestController
@RequestMapping("/pancake")
@RequiredArgsConstructor
public class TestPancakeOrderController {

  private final PancakeService service;

  @GetMapping("/createOrder")
  public ResponseEntity<OrderDetailResponse> createOrder() {
    OrderDetailResponse ok = service.getOrderPancake().fetchOrderById("5");
    OrderData orderData = ok.getData();
    List<Item> updatedItems =
        orderData.getItems().stream()
            .peek(
                item -> {
                  item.setQuantity(3);
                  item.setId(null);
                })
            .toList();
    orderData.setBillFullName("Nguyễn Thị Hoa");
    orderData.setBillPhoneNumber("09123456789");
    orderData.setItems(updatedItems);
    return ResponseEntity.ok(service.getOrderPancake().createOrder(orderData));
  }
  @GetMapping("/updateOrder/{orderId}")
  public ResponseEntity<OrderDetailResponse> updateOrder(@PathVariable String orderId) {
    OrderDetailResponse ok = service.getOrderPancake().fetchOrderById(orderId);
    OrderData orderData = ok.getData();
    orderData.setStatus(OrderStatusPancake.DELETE_ORDER.getCode());
    return ResponseEntity.ok(service.getOrderPancake().updateOrder(orderData, orderId));
  }
}
