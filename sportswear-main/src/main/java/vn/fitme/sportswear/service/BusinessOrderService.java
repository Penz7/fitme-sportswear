package vn.fitme.sportswear.service;

import java.time.LocalDateTime;
import java.util.*;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.constant.enums.OrderType;
import vn.fitme.sportswear.repository.OrderMappingRepository;
import vn.fitme.sportswear.repository.SapoOrderTrackingRepository;
import vn.fitme.sportswear.repository.ShopifyOrderMappingRepository;
import vn.fitme.sportswear.repository.entity.*;
import vn.fitme.sportswear.service.pancake.PancakeOrderMapperService;
import vn.fitme.sportswear.service.pancake.PancakeService;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;
import vn.fitme.sportswear.service.pancake.order.response.OrderDetailResponse;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.pancake.product.dto.VariationWarehouse;
import vn.fitme.sportswear.service.pancake.product.request.WarehouseRequest;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.dto.OrderLineItem;
import vn.fitme.sportswear.service.sapo.order.response.OrderResponse;
import vn.fitme.sportswear.service.shopify_v2.ShopifyService;
import vn.fitme.sportswear.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Getter
public class BusinessOrderService {
  @Value("${app.config.enable-create-order-in-pancake:false}")
  private boolean enableCreateOrderInPancake;

  @Value("${app.config.enable-sync-address:false}")
  private boolean enableSyncAddress;

  private static final String PREFIX_SHOPIFY = "AUTO_SHOPIFY";

  private final PancakeService pancakeService;
  private final SapoService sapoService;
  private final PancakeOrderMapperService pancakeOrderMapperService;
  private final ShopifyService shopifyService;

  private final SapoOrderTrackingRepository sapoOrderTrackingRepository;
  private final OrderMappingRepository orderMappingRepository;
  private final ShopifyOrderMappingRepository shopifyOrderMappingRepository;

  public void processTopOrders(OrderType type, String prefixName) {
    OrderResponse response = sapoService.fetchTopOrdersByType(type, prefixName);
    List<Order> orders = response.getOrders();
    List<String> orderIds = orders.stream().map(order -> String.valueOf(order.getId())).toList();
    if (!orders.isEmpty()) {
      sapoOrderTrackingRepository
          .findByType(type.name() + "_" + prefixName)
          .ifPresentOrElse(
              dbOrder -> {
                Set<String> oldSet = new HashSet<>(dbOrder.getOrderId());
                List<Order> onlyNewOrders =
                    orders.stream()
                        .filter(order -> !oldSet.contains(String.valueOf(order.getId())))
                        .toList();

                onlyNewOrders.forEach(order -> createOrUpdateOrder(type, order, prefixName));

                dbOrder.setOrderId(orderIds);
                dbOrder.setLastUpdate(LocalDateTime.now());
                sapoOrderTrackingRepository.save(dbOrder);
              },
              () ->
                  sapoOrderTrackingRepository.save(
                      new SapoOrderTracking(
                          orderIds, type.name() + "_" + prefixName, LocalDateTime.now())));
    }
  }

  public void createOrUpdateOrder(OrderType type, Order order, String prefixName) {
    try {
      if (PREFIX_SHOPIFY.equals(prefixName)) {
        if (OrderType.CANCELED.equals(type)) {
          handleCancelShopifyOrder(order);
        }
        return;
      }
      if (OrderType.PLACED.equals(type)) {
        createOrder(order);
      } else {
        updateOrder(order, type);
      }
      updateInventoryByOrder(order);
      Thread.sleep(10);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      log.error(
          "[createOrUpdateOrder] With OrderType: [{}], Order ID:[{}] has Error: ",
          type,
          order.getId(),
          e);
    }
  }

  private void createOrder(Order order) {
    try {
      if (enableCreateOrderInPancake) {
        OrderMapping mapping =
            orderMappingRepository.findBySapoOrderId(String.valueOf(order.getId()));
        if (mapping != null) {
          log.info(
              "[createOrder] Order ID: [{}] | Order mapping found ID: [{}], pancakeId: [{}]",
              mapping.getSapoOrderId(),
              mapping.getId(),
              mapping.getPancakeOrderId());
          return;
        }
        OrderData orderData = pancakeOrderMapperService.toOrderData(order);
        if (orderData == null) {
          log.info("[createOrder] Order ID: [{}] | OrderData is null ", order.getId());
          return;
        }
        log.info(
            "[createOrder] Order ID: [{}] | OrderData: \n{} ",
            order.getId(),
            JsonUtils.toJson(orderData));
        // insert pancake
        OrderDetailResponse orderDetailResponse =
            pancakeService.getOrderPancake().createOrder(orderData);
        mapping =
            new OrderMapping(
                String.valueOf(order.getId()), // sapo
                String.valueOf(orderDetailResponse.getData().getId()), // pancake
                LocalDateTime.now());
        orderMappingRepository.save(mapping);
        log.info(
            "[createOrder] Order ID: [{}] | Success: \n{} ",
            order.getId(),
            JsonUtils.toJson(orderDetailResponse));
      } else {
        log.info(
            "[createOrder] Order ID: [{}] | Create order in pancake is disabled", order.getId());
      }
    } catch (Exception e) {
      log.error("[createOrder] With Order ID:[{}] has Error: ", order.getId(), e);
    }
  }

  private void updateOrder(Order order, OrderType type) {
    try {
      OrderMapping mapping =
          orderMappingRepository.findBySapoOrderId(String.valueOf(order.getId()));
      if (mapping == null) {
        log.info(
            "[updateOrder] OrderType: {} | Order ID: [{}] | Order mapping not found ",
            type,
            order.getId());
        return;
      }
      OrderData orderData = pancakeOrderMapperService.toOrderData(order);
      if (orderData == null) {
        log.info(
            "[updateOrder] OrderType: {} | Order ID: [{}] | OrderData is null ",
            type,
            order.getId());
        return;
      }
      log.info(
          "[updateOrder] OrderType: {} | Order ID: [{}] | Pancake Order ID: [{}] | OrderData: \n{} ",
          type,
          order.getId(),
          mapping.getPancakeOrderId(),
          JsonUtils.toJson(orderData));
      // update pancake
      OrderDetailResponse orderDetailResponse =
          pancakeService.getOrderPancake().updateOrder(orderData, mapping.getPancakeOrderId());
      if (Objects.nonNull(orderDetailResponse) && Objects.nonNull(orderDetailResponse.getData())) {
        mapping.setPancakeStatus(orderDetailResponse.getData().getStatus());
      }
      mapping.setUpdatedAt(LocalDateTime.now());
      orderMappingRepository.save(mapping);
      log.info(
          "[updateOrder] Order ID: [{}] | Success: \n{} ",
          order.getId(),
          JsonUtils.toJson(orderDetailResponse));
    } catch (Exception e) {
      log.error("[updateOrder] With Order ID:[{}] has Error: ", order.getId(), e);
    }
  }

  private void updateInventoryByOrder(Order order) {
    if (order == null) {
      log.error("[updateInventoryByOrder] Order is null");
      return;
    }

    try {
      List<OrderLineItem> orderLineItems = order.getOrderLineItems();
      if (orderLineItems == null || orderLineItems.isEmpty()) {
        log.warn("[updateInventoryByOrder] No order line items for Order ID: [{}]", order.getId());
        return;
      }

      orderLineItems.forEach(
          orderLineItem -> {
            try {
              String sku = orderLineItem.getSku();
              if (sku == null || sku.isBlank()) {
                log.warn(
                    "[updateInventoryByOrder] SKU is null or blank for Order ID: [{}]",
                    order.getId());
                return;
              }

              ProductData productData = pancakeService.checkInPancake(sku);
              if (productData == null) {
                log.warn(
                    "[updateInventoryByOrder] No productData for SKU: [{}] | Order ID: [{}]",
                    sku,
                    order.getId());
                return;
              }

              List<VariationWarehouse> variations = productData.getVariationsWarehouses();
              if (variations == null || variations.isEmpty()) {
                log.warn(
                    "[updateInventoryByOrder] No variations for SKU: [{}] | Order ID: [{}]",
                    sku,
                    order.getId());
                return;
              }

              for (VariationWarehouse variationWarehouse : variations) {
                try {
                  WarehouseRequest request = getWarehouseRequest(orderLineItem, variationWarehouse);
                  pancakeService.getProductPanCake().updateQuantity(productData.getId(), request);
                } catch (Exception e) {
                  log.error(
                      "[updateInventoryByOrder] Error updating inventory for SKU: [{}] | Order ID: [{}]",
                      sku,
                      order.getId(),
                      e);
                }
              }
            } catch (Exception innerEx) {
              log.error(
                  "[updateInventoryByOrder] Error handling item in Order ID: [{}]",
                  order.getId(),
                  innerEx);
            }
          });

      log.info("[updateInventoryByOrder] Order ID: [{}] | Success", order.getId());
    } catch (Exception e) {
      log.error("[updateInventoryByOrder] With Order ID:[{}] has Error: ", order.getId(), e);
    }
  }

  private static WarehouseRequest getWarehouseRequest(OrderLineItem orderLineItem, VariationWarehouse variationWarehouse) {
    WarehouseRequest request = new WarehouseRequest();
    VariationWarehouse warehouse = new VariationWarehouse();
    warehouse.setWarehouseId(
        variationWarehouse.getWarehouseId() == null
            ? PancakeStaticUtil.warehouseId
            : variationWarehouse.getWarehouseId());
    warehouse.setRemainQuantity(orderLineItem.getQuantity());
    request.setVariationsWarehouses(List.of(warehouse));
    return request;
  }

  private void handleCancelShopifyOrder(Order order) {
    try {
      ShopifyOrderMapping mapping =
          shopifyOrderMappingRepository.findBySapoOrderId(String.valueOf(order.getId()));
      if (mapping == null) {
        log.info("[handleCancelOrder] Order ID: [{}] | Order mapping not found ", order.getId());
        return;
      }
      shopifyService.getShopifySdk().cancelOrder(mapping.getShopifyOrderId(), "Cancelled by Sapo");
      log.info("[handleCancelOrder] Order ID: [{}] | Success", order.getId());
    } catch (Exception e) {
      log.error("[handleCancelOrder] With Order ID:[{}] has Error: ", order.getId(), e);
    }
  }
}
