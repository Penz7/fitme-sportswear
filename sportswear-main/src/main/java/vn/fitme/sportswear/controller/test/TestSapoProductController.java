package vn.fitme.sportswear.controller.test;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.product.request.PurchaseOrderResponse;
import vn.fitme.sportswear.service.sapo.product.response.ProductResponse;

@RestController
@RequestMapping("/sapo")
@RequiredArgsConstructor
public class TestSapoProductController {

  private final SapoService sapoService;

  @GetMapping("/fetchPurchaseOrders/{page}/{limit}")
  public ResponseEntity<PurchaseOrderResponse> fetchPurchaseOrders(
      @PathVariable Integer page, @PathVariable Integer limit) {
    return ResponseEntity.ok(sapoService.getProductSapo().fetchPurchaseOrders(page, limit));
  }

  @GetMapping("/fetchProducts/{page}/{limit}")
  public ResponseEntity<ProductResponse> fetchProducts(
      @PathVariable Integer page, @PathVariable Integer limit) {
    return ResponseEntity.ok(sapoService.getProductSapo().fetchProducts(page, limit));
  }
}
