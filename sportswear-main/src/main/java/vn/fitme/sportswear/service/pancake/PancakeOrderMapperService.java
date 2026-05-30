package vn.fitme.sportswear.service.pancake;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.constant.enums.OrderStatusPancake;
import vn.fitme.sportswear.constant.enums.OrderStatusSapo;
import vn.fitme.sportswear.constant.enums.OrderType;
import vn.fitme.sportswear.repository.PancakeProductRepository;
import vn.fitme.sportswear.repository.entity.PancakeProduct;
import vn.fitme.sportswear.service.pancake.order.dto.ShippingAddress;
import vn.fitme.sportswear.service.pancake.order.dto.VariationInfo;
import vn.fitme.sportswear.service.pancake.order.request.OrderData;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.pancake.order.dto.Item;
import vn.fitme.sportswear.service.sapo.order.dto.OrderLineItem;
import vn.fitme.sportswear.util.PancakeStaticUtil;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PancakeOrderMapperService {
  private final PancakeProductRepository pancakeProductRepository;
  private final PancakeService pService;

  public OrderData toOrderData(Order order) {
    if (order == null) {
      return null;
    }

    OrderData orderData = new OrderData();

    // Mapping các field đơn giản
    orderData.setTotalPrice(Math.floor(order.getTotal()));
    orderData.setTotalDiscount(BigDecimal.valueOf(Math.floor(order.getTotalDiscount())));
    orderData.setNote(order.getNote());
    orderData.setShopId(order.getSourceId()); // Giả sử sourceId là shopId
    OrderStatusSapo orderStatusSapo = OrderStatusSapo.findByValue(order.getStatus());
    OrderType orderType = OrderType.fromSapoStatus(orderStatusSapo);

    if (orderType == null) {
      orderStatusSapo = OrderStatusSapo.findByValue(order.getPackedStatus());
      orderType = OrderType.fromSapoStatus(orderStatusSapo);
      if (orderType.equals(OrderType.PACKED)) {
        orderStatusSapo = OrderStatusSapo.findByValue(order.getFulfillmentStatus());
        orderType = OrderType.fromSapoStatus(orderStatusSapo);
      } else {
        return null;
      }
    }
    OrderStatusPancake orderStatusPancake = OrderStatusPancake.findByCode(orderType.getCode());
    if (orderStatusPancake == null) {
      return null;
    }
    orderData.setStatusName(orderStatusPancake.getDescription());
    orderData.setStatus(orderType.getCode());

    orderData.setWarehouseId(PancakeStaticUtil.warehouseId);

    // Mapping CustomerData sang billFullName & billPhoneNumber
    if (order.getCustomerData() != null) {
      orderData.setBillFullName(order.getCustomerData().getName());
      if (order.getCustomerData().getAddresses() != null
          && !order.getCustomerData().getAddresses().isEmpty()) {
        orderData.setBillPhoneNumber(
            order.getCustomerData().getAddresses().getFirst().getPhoneNumber());
      }
    }

    // Mapping ShippingAddress
    if (order.getShippingAddress() != null) {
      ShippingAddress shippingAddress = new ShippingAddress();
      shippingAddress.setAddress(order.getShippingAddress().getAddress1());
      shippingAddress.setProvinceId(order.getShippingAddress().getCity());
      shippingAddress.setDistrictId(order.getShippingAddress().getDistrict());
      shippingAddress.setPhoneNumber(order.getShippingAddress().getPhoneNumber());
      orderData.setShippingAddress(shippingAddress);
    }

    // Mapping OrderLineItem → Item
    if (order.getOrderLineItems() != null) {
      List<Item> items =
          order.getOrderLineItems().stream()
              .map(this::toItem)
              .collect(Collectors.toCollection(ArrayList::new));
      orderData.setItems(items);
    }

    return orderData;
  }

  private Item toItem(OrderLineItem orderLineItem) {
    if (orderLineItem == null) {
      return null;
    }

    Item item = new Item();
    PancakeProduct product = pancakeProductRepository.findBySku(orderLineItem.getSku());
    String variationId;
    String productId;
    if (product == null) {
      ProductData productData = pService.checkInPancake(orderLineItem.getSku());
      variationId = productData.getId();
      productId = productData.getProductId();
    } else {
      variationId = String.valueOf(product.getVariantId());
      productId = String.valueOf(product.getProductId());
    }
    item.setVariationId(variationId);
    item.setProductId(productId);
    VariationInfo variationInfo = item.getVariationInfo();
    if (variationInfo == null) {
      variationInfo = new VariationInfo();
    }
    variationInfo.setRetailPrice(orderLineItem.getPrice());
    variationInfo.setBarcode(orderLineItem.getSku());
    variationInfo.setDisplayId(orderLineItem.getSku());
    item.setQuantity(orderLineItem.getQuantity());
    item.setVariationInfo(variationInfo);
    return item;
  }
}
