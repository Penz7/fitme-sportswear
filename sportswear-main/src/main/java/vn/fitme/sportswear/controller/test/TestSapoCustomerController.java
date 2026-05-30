package vn.fitme.sportswear.controller.test;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.customer.response.CustomerResponse;

@RestController
@RequestMapping("/sapo")
@RequiredArgsConstructor
public class TestSapoCustomerController {

  private final SapoService sapoService;

  @GetMapping("/fetchCustomers/{phoneNumber}")
  public ResponseEntity<CustomerResponse> fetchCustomers(@PathVariable String phoneNumber) {
    return ResponseEntity.ok(sapoService.getCustomerSapo().fetchCustomers(1, 1, phoneNumber));
  }
}
