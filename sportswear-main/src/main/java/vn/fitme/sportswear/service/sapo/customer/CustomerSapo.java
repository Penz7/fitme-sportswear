package vn.fitme.sportswear.service.sapo.customer;

import static vn.fitme.sportswear.constant.SapoConstant.*;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.SapoApi;
import vn.fitme.sportswear.service.sapo.customer.request.CustomerData;
import vn.fitme.sportswear.service.sapo.customer.response.CustomerResponse;

@Service
@RequiredArgsConstructor
public class CustomerSapo {
  private final SapoApi sapoApi;

  ///
  // admin/customers/doSearch.json?query.contains=090909519&page=1&limit=10&statuses.in=active&condition_type=must
  public CustomerResponse fetchCustomers(int page, int limit, String phoneNumber) {
    String url =
        UriComponentsBuilder.fromUriString(CUSTOMER_SEARCH_URL)
            .queryParam(PAGE, page)
            .queryParam(LIMIT, limit)
            .queryParam("query.contains", phoneNumber)
            .queryParam("statuses.in", "active")
            .queryParam("condition_type", "must")
            .toUriString();
    return sapoApi.exchange(url, HttpMethod.GET, null, CustomerResponse.class);
  }

  // Tao 1 khach hang
  public CustomerData createCustomer(CustomerData customer) {
    String url = UriComponentsBuilder.fromUriString(CUSTOMER_URL).toUriString();
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);

    HttpEntity<CustomerData> requestEntity = new HttpEntity<>(customer, headers);
    return sapoApi.exchange(url, HttpMethod.POST, requestEntity, CustomerData.class);
  }

}
