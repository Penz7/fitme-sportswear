package vn.fitme.sportswear.service.shopify_v2;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.common.thirdapp.GeminiService;
import vn.fitme.sportswear.common.thirdapp.TelegramService;
import vn.fitme.sportswear.mapper.FulfillmentShopifyMapper;
import vn.fitme.sportswear.mapper.LineItemShopifyMapper;
import vn.fitme.sportswear.repository.ShopifyOrderMappingRepository;
import vn.fitme.sportswear.repository.entity.ShopifyOrderMapping;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.customer.dto.Address;
import vn.fitme.sportswear.service.sapo.customer.dto.Customer;
import vn.fitme.sportswear.service.sapo.customer.request.CustomerData;
import vn.fitme.sportswear.service.sapo.customer.response.CustomerResponse;
import vn.fitme.sportswear.service.sapo.order.fulfilment.Fulfillment;
import vn.fitme.sportswear.service.sapo.order.fulfilment.FulfillmentRequest;
import vn.fitme.sportswear.service.sapo.order.request.OrderData;
import vn.fitme.sportswear.service.shopify.model.ShopifyFulfillmentCreationRequest;
import vn.fitme.sportswear.service.shopify.model.ShopifyFulfillmentOrder;
import vn.fitme.sportswear.service.shopify.model.ShopifyLocation;
import vn.fitme.sportswear.service.shopify_v2.dto.Order;
import vn.fitme.sportswear.util.DynamicTableManagerUtil;
import vn.fitme.sportswear.util.JsonUtils;
import vn.fitme.sportswear.util.StringUtil;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopifyWebhookService {
  @Value("${app.config.enable-webhook:false}")
  private boolean enableWebhook;

  private final ShopifyService shopifyService;
  private final SapoService sapoService;
  private static final ObjectMapper objectMapper = new ObjectMapper();
  private final ShopifyOrderMappingRepository orderMappingRepository;
  private final ShopifyOrderConverterService shopifyOrderConverterService;
  private final TelegramService telegramService;
  private final GeminiService geminiService;
  private final FulfillmentShopifyMapper fulfillmentShopifyMapper;
  private final LineItemShopifyMapper lineItemShopifyMapper;
  private static String locationId = null;

  public void handleOrderWebhook(String body) {
    Order orderDTO;
    try {
      orderDTO = objectMapper.readValue(body, Order.class);
      if (!enableWebhook) {
        log.info(
            "[handleOrderWebhook] Enable webhook is false. Payload: \n{}", JsonUtils.toJson(body));
        log.info(
            "[handleOrderWebhook] Enable webhook is false. OrderDTO: \n{}",
            JsonUtils.toJson(orderDTO));
        return;
      }
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
    try {

      String shopifyOrderId = orderDTO.getId();
      ShopifyOrderMapping orderMapping =
          orderMappingRepository.findByShopifyOrderId(shopifyOrderId);
      // NEW
      if (orderMapping == null) {
        vn.fitme.sportswear.service.sapo.order.dto.Order order =
            shopifyOrderConverterService.convertOrderDTOToOrder(orderDTO);
        order.setCode("AUTO_SHOPIFY_" + orderDTO.getOrderNumber());
        CustomerResponse customerResponse =
            sapoService.getCustomerSapo().fetchCustomers(1, 1, order.getPhoneNumber());
        Long customerId;
        if (customerResponse.getCustomers().isEmpty()) {
          Customer data = getCustomer(orderDTO);
          CustomerData customerRequest = new CustomerData(data);
          CustomerData customerData = sapoService.getCustomerSapo().createCustomer(customerRequest);
          customerId = customerData.getCustomer().getId();
        } else {
          customerId = customerResponse.getCustomers().getFirst().getId();
        }
        order.setCustomerId(customerId);
        order.setLocationId(572310L);
        OrderData orderData = new OrderData(order);
        OrderData response = sapoService.getOrderSapo().createOrder(orderData);
        String sapoOrderId = String.valueOf(response.getOrder().getId());
        sapoService.getOrderSapo().finalizeOrder(sapoOrderId);
        // So tien khach da thanh toan
        //        if (Objects.nonNull(orderDTO.getTotalPrice()) && orderDTO.getTotalPrice() > 0) {
        //          Long amount = Long.valueOf(orderDTO.getSubtotalPrice());
        //          PrepaymentData prepaymentData =
        //              PrepaymentData.builder()
        //                  .prepayment(
        //                      PrepaymentData.Prepayment.builder()
        //                          .paymentMethodId(2575663L)
        //                          .paymentMethodName("Chuyển khoản")
        //                          .amount(amount)
        //                          .paidAmount(amount)
        //                          .returnedAmount(0L)
        //                          .paidOn(
        //                              ZonedDateTime.now(ZoneOffset.UTC)
        //                                  .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
        //                          .build())
        //                  .build();
        //          sapoService.getOrderSapo().prepaymentsOrder(sapoOrderId, prepaymentData);
        //        }
        orderMapping = new ShopifyOrderMapping(sapoOrderId, shopifyOrderId);
        orderMapping.setShopifyStatus("NEW");
        orderMappingRepository.save(orderMapping);
        log.info("[handleOrderWebhook] Done step NEW with ID: {}", shopifyOrderId);
      }
      orderMapping = orderMappingRepository.findByShopifyOrderId(shopifyOrderId);
      if (orderMapping != null) {
        // process CONFIRMED
        orderMapping.setShopifyStatus("CONFIRMED");
        String sapoOrderId = orderMapping.getSapoOrderId();
        OrderData orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);
        if (orderDetailResponse == null || orderDetailResponse.getOrder() == null) return;
        vn.fitme.sportswear.service.sapo.order.dto.Order order = orderDetailResponse.getOrder();
        order = shopifyOrderConverterService.convertOrderDTOToOrder(order, orderDTO);
        order.setLocationId(572310L);
        OrderData orderData = new OrderData(order);
        sapoService.getOrderSapo().updateOrder(sapoOrderId, orderData);
        log.info("[handleOrderWebhook] Done step CONFIRMED with ID: {}", shopifyOrderId);
        // process PACKING
        orderMapping.setShopifyStatus("PACKING");
        orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);
        if (orderDetailResponse == null || orderDetailResponse.getOrder() == null) return;
        order = orderDetailResponse.getOrder();
        Fulfillment fulfillment = fulfillmentShopifyMapper.convert(orderDTO, order);
        if (Objects.isNull(fulfillment)) {
          return;
        }
        FulfillmentRequest fulfillmentRequest = new FulfillmentRequest();
        fulfillmentRequest.setFulfillment(fulfillment);
        sapoService.getOrderSapo().fulfillmentOrder(fulfillmentRequest, sapoOrderId);
        String code;
        vn.fitme.sportswear.service.sapo.order.dto.Fulfillment fulfillmentSapo;
        Integer count = 0;
        while (true) {
          count++;
          if (count > 10) {
            throw new RuntimeException("Can't get tracking code");
          }
          Thread.sleep(1000);
          orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);
          if (orderDetailResponse == null || orderDetailResponse.getOrder() == null) return;
          order = orderDetailResponse.getOrder();
          if(order.getFulfillments() == null || order.getFulfillments().isEmpty()) {
            continue;
          }
          fulfillmentSapo = order.getFulfillments().getFirst();
          var shipment = fulfillmentSapo.getShipment();
          if (shipment != null && "completed".equals(shipment.getPushingStatus())) {
            code = shipment.getTrackingCode();
            break;
          }
        }
        log.info("[handleOrderWebhook] Done step PACKING with ID: {}", shopifyOrderId);
        // process SHIPPED
        //        orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);
        //        order = orderDetailResponse.getOrder();
        //        orderMapping.setShopifyStatus("SHIPPED");
        //        Thread.sleep(1000);
        //        Object ok =
        //            sapoService
        //                .getOrderSapo()
        //                .deliveryOrder(sapoOrderId, order.getFulfillments().getFirst().getId());
        //        log.info(
        //            "[handleOrderWebhook] SapoOrderId: [{}] | SHIPPED RESPONSE: \n{}",
        //            sapoOrderId,
        //            JsonUtils.toJson(ok));
        //        log.info("[handleOrderWebhook] Done step SHIPPED with ID: {}", shopifyOrderId);

        if (locationId == null) {
          List<ShopifyLocation> shopifyLocations = shopifyService.getShopifySdk().getLocations();
          locationId = shopifyLocations.getFirst().getId();
        }

        List<ShopifyFulfillmentOrder> fulfillmentOrders = new LinkedList<>();
        for (int i = 0; i < 3; i++) {
          fulfillmentOrders =
              shopifyService.getShopifySdk().getFulfillmentOrdersFromOrder(shopifyOrderId);
          if (!fulfillmentOrders.isEmpty()) break;
          Thread.sleep(1500); // Delay 1.5s
        }
        ShopifyFulfillmentCreationRequest shopifyFulfillmentCreationRequest =
            ShopifyFulfillmentCreationRequest.newBuilder()
                .withOrderId(shopifyOrderId)
                .withTrackingCompany("Viettel")
                .withTrackingNumber(code)
                .withNotifyCustomer(true)
                .withLineItems(lineItemShopifyMapper.toShopifyLineItemList(orderDTO.getLineItems()))
                .withLocationId(locationId)
                .withTrackingUrls(new ArrayList<>())
                .build();
        if (fulfillmentOrders.isEmpty()) {
          shopifyService.getShopifySdk().createFulfillment(shopifyFulfillmentCreationRequest);
        } else {
          shopifyService
              .getShopifySdk()
              .createFulfillment(shopifyFulfillmentCreationRequest, fulfillmentOrders);
        }
        orderMappingRepository.save(orderMapping);
        log.info("[handleOrderWebhook] Done step FULFILLMENT with ID: {}", shopifyOrderId);
      }

    } catch (Exception e) {
      telegramService.sendException("[handleOrderWebhook] Error: ", e);
      log.info(
          "====================================START ERROR=======================================");
      log.info("[handleOrderWebhook] Payload: \n{}", JsonUtils.toJson(body));
      log.info("[handleOrderWebhook] orderId: {}", orderDTO.getId());
      log.error("[handleOrderWebhook] Error: ", e);
      log.info(
          "=====================================END ERROR======================================");
    }
  }

  private Customer getCustomer(Order orderDTO) {
    Customer data = new Customer();
    data.setPhoneNumber(
        StringUtil.normalizePhone(
            StringUtil.NVL(
                orderDTO.getShippingAddress().getPhone(),
                orderDTO.getBillingAddress().getPhone(),
                orderDTO.getCustomer().getDefaultAddress().getPhone())));
    data.setName(
        StringUtil.NVL(
            orderDTO.getShippingAddress().getFirstName(),
            orderDTO.getBillingAddress().getFirstName(),
            orderDTO.getCustomer().getFirstName()));
    Address address = new Address();
    address.setCountry(
        StringUtil.NVL(
            orderDTO.getShippingAddress().getCountry(),
            orderDTO.getBillingAddress().getCountry(),
            orderDTO.getCustomer().getDefaultAddress().getCountry()));
    address.setCity(
        StringUtil.NVL(
            orderDTO.getShippingAddress().getCity(),
            orderDTO.getBillingAddress().getCity(),
            orderDTO.getCustomer().getDefaultAddress().getCity()));
    address.setDistrict(
        StringUtil.NVL(
            orderDTO.getShippingAddress().getProvince(),
            orderDTO.getBillingAddress().getProvince(),
            orderDTO.getCustomer().getDefaultAddress().getProvince()));
    address.setWard(
        StringUtil.NVL(
            orderDTO.getShippingAddress().getAddress1(),
            orderDTO.getBillingAddress().getAddress1(),
            orderDTO.getCustomer().getDefaultAddress().getAddress1()));
    address.setAddress1(
        StringUtil.NVL2(
                StringUtil.NVL(
                    orderDTO.getShippingAddress().getAddress2(),
                    orderDTO.getBillingAddress().getAddress2(),
                    orderDTO.getCustomer().getDefaultAddress().getAddress2()),
                "")
            + StringUtil.NVL2(address.getWard(), "")
            + StringUtil.NVL2(address.getDistrict(), "")
            + StringUtil.NVL2(address.getCity(), "")
            + address.getCountry());
    try {
      String message = geminiService.generateContent(address.getAddress1());
      Map<String, Object> mapping = DynamicTableManagerUtil.findBestMatch(message);
      address.setWard(mapping.get("sapo_wardname").toString());
      address.setDistrict(mapping.get("sapo_district").toString());
      address.setCity(mapping.get("sapo_city").toString());
    } catch (Exception e) {
      log.error("[convertBaseAddress] Error: ", e);
    }

    data.setAddresses(List.of(address));
    return data;
  }
}
