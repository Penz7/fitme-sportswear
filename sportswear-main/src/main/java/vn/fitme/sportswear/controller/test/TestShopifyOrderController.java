package vn.fitme.sportswear.controller.test;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.service.shopify.model.ShopifyOrder;
import vn.fitme.sportswear.service.shopify_v2.ShopifyService;

@RestController
@RequestMapping("/shopify")
@RequiredArgsConstructor
public class TestShopifyOrderController {

  private final ShopifyService service;

  @GetMapping("/getOrder/{orderId}")
  public ResponseEntity<ShopifyOrder> getOrder(@PathVariable String orderId) {
    return ResponseEntity.ok(service.getShopifySdk().getOrder(orderId));
  }
}
