package vn.fitme.sportswear.processor.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vn.fitme.sportswear.common.thirdapp.TelegramService;
import vn.fitme.sportswear.processor.WebhookProcessor;
import vn.fitme.sportswear.repository.OrderMappingRepository;
import vn.fitme.sportswear.repository.entity.OrderMapping;
import vn.fitme.sportswear.service.pancake.PancakeOrderConverterService;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.customer.dto.Address;
import vn.fitme.sportswear.service.sapo.customer.dto.Customer;
import vn.fitme.sportswear.service.sapo.customer.request.CustomerData;
import vn.fitme.sportswear.service.sapo.customer.response.CustomerResponse;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.request.OrderData;
import vn.fitme.sportswear.processor.dto.OrderDTO;
import vn.fitme.sportswear.service.sapo.order.dto.PrepaymentData;
import vn.fitme.sportswear.util.JsonUtils;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderCreatedProcessor implements WebhookProcessor {
  @Value("${app.config.enable-webhook:false}")
  private boolean enableWebhook;

  private final SapoService sapoService;
  private final PancakeOrderConverterService pancakeOrderConverterService;
  private final OrderMappingRepository orderMappingRepository;
  private final TelegramService telegramService;

  @Override
  public void process(JsonNode payload) {
    OrderDTO orderDTO;
    try {
      orderDTO = new ObjectMapper().treeToValue(payload, OrderDTO.class);
//      boolean isAdmin = orderDTO.getCreator().getFbId().equals("509473979448215");
      if (!enableWebhook) {
        log.info(
                "[OrderCreatedProcessor] Enable webhook is false. Payload: \n{}",
                JsonUtils.toJson(payload));
        log.info(
                "[OrderCreatedProcessor] Enable webhook is false. OrderDTO: \n{}",
                JsonUtils.toJson(orderDTO));
        return;
      }
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
    try {
      String pancakeOrderId = orderDTO.getId().toString();
      OrderMapping orderMapping = orderMappingRepository.findByPancakeOrderId(pancakeOrderId);
      // dat hang
      if (orderMapping == null) {
        Order order = pancakeOrderConverterService.convertOrderDTOToOrder(orderDTO);
        order.setCode("AUTO_PANCAKE_" + pancakeOrderId);
        CustomerResponse customerResponse =
            sapoService.getCustomerSapo().fetchCustomers(1, 1, order.getPhoneNumber());
        Long customerId;
        if (customerResponse.getCustomers().isEmpty()) {
          Customer data = new Customer();
          data.setPhoneNumber(order.getPhoneNumber());
          data.setName(orderDTO.getBillFullName());
          Address address = new Address();
          address.setAddress1(orderDTO.getShippingAddress().getFullAddress());
          data.setAddresses(List.of(address));
          CustomerData customerRequest = new CustomerData(data);
          log.info(
              "[OrderCreatedProcessor] CustomerRequest: \n{}", JsonUtils.toJson(customerRequest));
          CustomerData customerData = sapoService.getCustomerSapo().createCustomer(customerRequest);
          customerId = customerData.getCustomer().getId();
        } else {
          customerId = customerResponse.getCustomers().getFirst().getId();
        }
        order.setCustomerId(customerId);
        order.setLocationId(572310L);
        OrderData orderData = new OrderData(order);
        log.info("[OrderCreatedProcessor] OrderData: \n{}", JsonUtils.toJson(orderData));
        OrderData response = sapoService.getOrderSapo().createOrder(orderData);
        String sapoOrderId = String.valueOf(response.getOrder().getId());
        response = sapoService.getOrderSapo().finalizeOrder(sapoOrderId);
        if (Objects.nonNull(orderDTO.getPrepaid()) && orderDTO.getPrepaid() > 0) {
          Long amount = orderDTO.getPrepaid().longValue();
          PrepaymentData prepaymentData =
              PrepaymentData.builder()
                  .prepayment(
                      PrepaymentData.Prepayment.builder()
                          .paymentMethodId(2575663L)
                          .paymentMethodName("Chuyển khoản")
                          .amount(amount)
                          .paidAmount(amount)
                          .returnedAmount(0L)
                          .paidOn(
                              ZonedDateTime.now(ZoneOffset.UTC)
                                  .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                          .build())
                  .build();

          log.info(
              "[OrderCreatedProcessor] getPrepaid: {} \ngetPrepayment: \n{}",
              amount,
              prepaymentData.getPrepayment());
          sapoService.getOrderSapo().prepaymentsOrder(sapoOrderId, prepaymentData);
        }
        orderMapping =
            new OrderMapping(
                sapoOrderId, // sapo
                pancakeOrderId, // pancake
                LocalDateTime.now());
        orderMappingRepository.save(orderMapping);
        log.info("[OrderCreatedProcessor] Success: \n{}", JsonUtils.toJson(response));
      }
    } catch (Exception e) {
      telegramService.sendException("[OrderCreatedProcessor] Error: ", e);
      log.info("====================================START ERROR=======================================");
      log.info("[OrderCreatedProcessor] Payload: \n{}", JsonUtils.toJson(payload));
      log.info("[OrderCreatedProcessor] OrderDTO: \n{}", JsonUtils.toJson(orderDTO));
      log.error("[OrderCreatedProcessor] Error: ", e);
      log.info("=====================================END ERROR======================================");
    }
  }

  @Override
  public String getEventType() {
    return "order_created";
  }
}
