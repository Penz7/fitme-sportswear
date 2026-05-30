package vn.fitme.sportswear.processor.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import vn.fitme.sportswear.common.thirdapp.TelegramService;
import vn.fitme.sportswear.constant.enums.OrderStatusPancake;
import vn.fitme.sportswear.mapper.FulfillmentPancakeMapper;
import vn.fitme.sportswear.processor.WebhookProcessor;
import vn.fitme.sportswear.repository.OrderMappingRepository;
import vn.fitme.sportswear.repository.entity.OrderMapping;
import vn.fitme.sportswear.service.pancake.PancakeOrderConverterService;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.fulfilment.Fulfillment;
import vn.fitme.sportswear.service.sapo.order.fulfilment.FulfillmentRequest;
import vn.fitme.sportswear.service.sapo.order.request.OrderData;
import vn.fitme.sportswear.processor.dto.OrderDTO;
import vn.fitme.sportswear.util.JsonUtils;

import java.time.LocalDateTime;
import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderUpdatedProcessor implements WebhookProcessor {
  @Value("${app.config.enable-webhook:false}")
  private boolean enableWebhook;

  private final SapoService sapoService;
  private final OrderMappingRepository orderMappingRepository;
  private final PancakeOrderConverterService pancakeOrderConverterService;

  private final FulfillmentPancakeMapper fulfillmentPancakeMapper;
  private final TelegramService telegramService;

  @Override
  public void process(JsonNode payload) {
    OrderDTO orderDTO;
    OrderMapping orderMapping;
    try {
      orderDTO = new ObjectMapper().treeToValue(payload, OrderDTO.class);
      //      boolean isAdmin = orderDTO.getCreator().getFbId().equals("509473979448215");
      if (!enableWebhook) {
        log.info(
            "[OrderUpdatedProcessor] Enable webhook is false. Payload: \n{}",
            JsonUtils.toJson(payload));
        log.info(
            "[OrderUpdatedProcessor] Enable webhook is false. OrderDTO: \n{}",
            JsonUtils.toJson(orderDTO));
        return;
      }
      orderMapping = orderMappingRepository.findByPancakeOrderId(orderDTO.getId().toString());
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    try {
      if (orderMapping != null) {
        String sapoOrderId = orderMapping.getSapoOrderId();
        OrderData orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);

        if (orderDetailResponse != null && orderDetailResponse.getOrder() != null) {
          Order order = orderDetailResponse.getOrder();
          OrderStatusPancake statusPancake = OrderStatusPancake.findByCode(orderDTO.getStatus());
          switch (statusPancake) {
            case NEW,
                WAITING_FOR_STOCK,
                WAITING_FOR_SHIPPING,
                RECEIVED,
                MONEY_COLLECTED,
                RETURNING,
                RETURNED,
                DELETE_ORDER ->
                log.info("[OrderUpdatedProcessor] === Don't need to update order!");
            case CONFIRMED -> {
              order = pancakeOrderConverterService.convertOrderDTOToOrder(order, orderDTO);
              order.setLocationId(572310L);
              OrderData orderData = new OrderData(order);
              OrderData updateOrder =
                  sapoService.getOrderSapo().updateOrder(sapoOrderId, orderData);
              log.info(
                  "[OrderUpdatedProcessor] SapoOrderId: [{}] | UpdateOrder: \n{}",
                  sapoOrderId,
                  JsonUtils.toJson(updateOrder));
            }
            case PACKING -> { // dang dong hang -> sapo dong goi
              Fulfillment fulfillment = fulfillmentPancakeMapper.convert(orderDTO, order);
              if (Objects.isNull(fulfillment)) {
                log.info(
                    "[OrderUpdatedProcessor] [PACKING] SapoOrderId: [{}] | Đơn hàng chưa có thông tin ship.",
                    sapoOrderId);
                log.info("[OrderUpdatedProcessor] [PACKING] Order: \n{}", JsonUtils.toJson(order));
                log.info(
                    "[OrderUpdatedProcessor] [PACKING] OrderDTO: \n{}", JsonUtils.toJson(orderDTO));
                return;
              }
              FulfillmentRequest fulfillmentRequest = new FulfillmentRequest();
              fulfillmentRequest.setFulfillment(fulfillment);
              log.info(
                  "[OrderUpdatedProcessor] SapoOrderId: [{}] | FulfillmentRequest: \n{}",
                  sapoOrderId,
                  JsonUtils.toJson(fulfillmentRequest));
              Object ok = null;
              try {
                ok = sapoService.getOrderSapo().fulfillmentOrder(fulfillmentRequest, sapoOrderId);
              } catch (HttpClientErrorException e) {
                if (e.getStatusCode().value() == 422) {
                  log.info(
                      "[OrderUpdatedProcessor] SapoOrderId: [{}] | getResponseBodyAsString: \n{}",
                      sapoOrderId,
                      e.getResponseBodyAsString());
                }
              }
              log.info(
                  "[OrderUpdatedProcessor] SapoOrderId: [{}] | FulfillmentResponse: \n{}",
                  sapoOrderId,
                  JsonUtils.toJson(ok));
            }
            case SHIPPED -> {
              if (order.getFulfillments().isEmpty()) {
                Fulfillment fulfillment = fulfillmentPancakeMapper.convert(orderDTO, order);
                if (Objects.isNull(fulfillment)) {
                  log.info(
                      "[OrderUpdatedProcessor] [SHIPPED] SapoOrderId: [{}] | Đơn hàng chưa có thông tin ship.",
                      sapoOrderId);
                  log.info(
                      "[OrderUpdatedProcessor] [SHIPPED] Order: \n{}", JsonUtils.toJson(order));
                  log.info(
                      "[OrderUpdatedProcessor] [SHIPPED] OrderDTO: \n{}",
                      JsonUtils.toJson(orderDTO));
                  return;
                }
                FulfillmentRequest fulfillmentRequest = new FulfillmentRequest();
                fulfillmentRequest.setFulfillment(fulfillment);
                sapoService.getOrderSapo().fulfillmentOrder(fulfillmentRequest, sapoOrderId);
                orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);
                order = orderDetailResponse.getOrder();
              }
              log.info(
                  "[OrderUpdatedProcessor] SapoOrderId: [{}] | DeliveryOrder: {}",
                  sapoOrderId,
                  order.getFulfillments().getFirst().getId());
              try {
                Object ok =
                    sapoService
                        .getOrderSapo()
                        .deliveryOrder(sapoOrderId, order.getFulfillments().getFirst().getId());
                log.info(
                    "[OrderUpdatedProcessor] SapoOrderId: [{}] | DeliveryOrderResponse: \n{}",
                    sapoOrderId,
                    JsonUtils.toJson(ok));
              } catch (HttpClientErrorException e) {
                if (e.getStatusCode().value() == 422
                    && e.getResponseBodyAsString().contains("fulfillment.status.not_suitable")) {
                  log.info(
                      "[OrderUpdatedProcessor] SapoOrderId: [{}] | Trạng thái của gói hàng không phù hợp để xuất kho.",
                      sapoOrderId);
                }
              }
            } // da gui hang -> sapo da xuat hang

            case CANCEL_ORDER -> { // da huy hang -> sapo huy don hang
              if (!order.getFulfillments().isEmpty()) {
                try {
                  sapoService
                      .getOrderSapo()
                      .cancelDeliveryOrder(sapoOrderId, order.getFulfillments().getLast().getId());
                } catch (Exception e) {
                  telegramService.sendException(
                      "[OrderUpdatedProcessor] cancelDeliveryOrder with sapoOrderId: ["
                          + sapoOrderId
                          + "] and fulfillmentId: ["
                          + order.getFulfillments().getLast().getId()
                          + "], Error: ",
                      e);
                }
                try {
                  sapoService
                      .getOrderSapo()
                      .receiveAfterCancellation(
                          sapoOrderId, order.getFulfillments().getLast().getId());
                } catch (Exception e) {
                  telegramService.sendException(
                      "[OrderUpdatedProcessor] receiveAfterCancellation with sapoOrderId: ["
                          + sapoOrderId
                          + "] and fulfillmentId: ["
                          + order.getFulfillments().getLast().getId()
                          + "], Error: ",
                      e);
                }
              }
              Object ok = null;
              try {
                ok = sapoService.getOrderSapo().cancelOrder(sapoOrderId);
              } catch (HttpClientErrorException e) {
                if (e.getStatusCode().value() == 422
                    && e.getResponseBodyAsString().contains("order.cancelled")) {
                  log.info(
                      "[OrderUpdatedProcessor] SapoOrderId: [{}] | Đơn hàng đã bị hủy.",
                      sapoOrderId);
                }
              } catch (Exception e) {
                telegramService.sendException(
                    "[OrderUpdatedProcessor] cancelOrder with sapoOrderId: ["
                        + sapoOrderId
                        + "], Error: ",
                    e);
              }
              log.info(
                  "[OrderUpdatedProcessor] SapoOrderId: [{}] | CancelOrderResponse: \n{}",
                  sapoOrderId,
                  JsonUtils.toJson(ok));
            }
            default -> log.info("[OrderUpdatedProcessor] StatusPancake: {}", statusPancake);
          }
        }
      }
    } catch (Exception e) {
      telegramService.sendException("[OrderUpdatedProcessor] Error: ", e);
      log.info(
          "====================================START ERROR=======================================");
      log.info("[OrderUpdatedProcessor] Payload: \n{}", JsonUtils.toJson(payload));
      log.info("[OrderUpdatedProcessor] OrderDTO: \n{}", JsonUtils.toJson(orderDTO));
      log.error("[OrderUpdatedProcessor] Error: ", e);
      log.info(
          "=====================================END ERROR======================================");
    } finally {
      if (Objects.nonNull(orderMapping)) {
        String sapoOrderId = orderMapping.getSapoOrderId();
        OrderData orderDetailResponse = sapoService.getOrderSapo().fetchOrderById(sapoOrderId);
        OrderStatusPancake statusPancake = OrderStatusPancake.findByCode(orderDTO.getStatus());
        orderMapping.setPancakeStatus(statusPancake.getCode());
        orderMapping.setPancakeStatusDescription(statusPancake.getDescription());
        orderMapping.setSapoStatus(orderDetailResponse.getOrder().getStatus());
        orderMapping.setSapoPackedStatus(orderDetailResponse.getOrder().getPackedStatus());
        orderMapping.setSapoFulfillmentStatus(
            orderDetailResponse.getOrder().getFulfillmentStatus());
        orderMapping.setSapoReceivedStatus(orderDetailResponse.getOrder().getReceivedStatus());
        orderMapping.setSapoPaymentStatus(orderDetailResponse.getOrder().getPaymentStatus());
        orderMapping.setSapoReturnStatus(orderDetailResponse.getOrder().getReturnStatus());
        orderMapping.setUpdatedAt(LocalDateTime.now());
        orderMappingRepository.save(orderMapping);
      }
    }
  }

  @Override
  public String getEventType() {
    return "order_updated";
  }
}
