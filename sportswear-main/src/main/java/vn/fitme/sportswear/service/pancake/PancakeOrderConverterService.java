package vn.fitme.sportswear.service.pancake;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.constant.enums.OrderStatusSapo;
import vn.fitme.sportswear.repository.SapoProductRepository;
import vn.fitme.sportswear.repository.entity.SapoProduct;
import vn.fitme.sportswear.service.sapo.order.dto.*;
import vn.fitme.sportswear.processor.dto.OrderDTO;
import vn.fitme.sportswear.util.SapoStaticUtil;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PancakeOrderConverterService {

  private final SapoProductRepository sapoProductRepository;

  public Order convertOrderDTOToOrder(OrderDTO orderDTO) {
    if (orderDTO == null) return null;

    Order order = new Order();
    order.setTotal(orderDTO.getTotalPrice() != null ? orderDTO.getTotalPrice() : null);
    order.setNote(orderDTO.getNote());
    order.setTags(
        orderDTO.getTags() != null ? new ArrayList<>(orderDTO.getTags()) : new ArrayList<>());
    order.setShippingAddress(convertShippingAddress(orderDTO.getShippingAddress()));
    order.setEmail(orderDTO.getBillEmail());
    order.setPhoneNumber(orderDTO.getBillPhoneNumber());
    order.setCustomerData(convertCustomerData(orderDTO.getCustomer()));
    order.setOrderLineItems(convertOrderItems(orderDTO.getItems()));
    order.setStatus(OrderStatusSapo.DAT_HANG.getValue());
    order.setSourceId(Long.valueOf(SapoStaticUtil.sourceId));
    return order;
  }

  public Order convertOrderDTOToOrder(Order order, OrderDTO orderDTO) {
    if (orderDTO == null) return null;

    order.setTotal(orderDTO.getTotalPrice() != null ? orderDTO.getTotalPrice() : null);
    order.setNote(orderDTO.getNote());
    order.setTags(
        orderDTO.getTags() != null ? new ArrayList<>(orderDTO.getTags()) : new ArrayList<>());
    order.setShippingAddress(convertShippingAddress(orderDTO.getShippingAddress()));
    order.setEmail(orderDTO.getBillEmail());
    order.setPhoneNumber(orderDTO.getBillPhoneNumber());
    order.setCustomerData(convertCustomerData(orderDTO.getCustomer()));
    order.setOrderLineItems(convertOrderItems(orderDTO.getItems()));
    order.setSourceId(Long.valueOf(SapoStaticUtil.sourceId));
    List<Fulfillment> fulfillments = order.getFulfillments();
    Fulfillment fulfillment;
    if (fulfillments == null || fulfillments.isEmpty()) {
      fulfillment = new Fulfillment();
      fulfillments = List.of(fulfillment);
    } else {
      fulfillment = fulfillments.getFirst();
    }
    Fulfillment.Shipment shipment = fulfillment.getShipment();
    if (shipment == null) {
      shipment = new Fulfillment.Shipment();
    }
    shipment.setFreightPayer(
        orderDTO.getIsFreeShipping() != null && orderDTO.getIsFreeShipping() ? "shop" : "customer");
    fulfillments.getFirst().setShipment(shipment);
    order.setFulfillments(fulfillments);
    return order;
  }

  private CustomerData convertCustomerData(OrderDTO.CustomerDTO customerDTO) {
    if (customerDTO == null) return null;

    CustomerData customerData = new CustomerData();
    customerData.setName(customerDTO.getName());
    customerData.setTags(new ArrayList<>());
    customerData.setAddresses(convertCustomerAddresses(customerDTO.getShopCustomerAddresses()));

    return customerData;
  }

  private List<Address> convertCustomerAddresses(List<OrderDTO.CustomerAddress> customerAddresses) {
    if (customerAddresses == null) return new ArrayList<>();

    List<Address> addresses = new ArrayList<>();
    for (OrderDTO.CustomerAddress addr : customerAddresses) {
      Address address = new Address();
      address.setFullName(addr.getFullName());
      address.setPhoneNumber(addr.getPhoneNumber());
      address.setAddress1(addr.getFullAddress());
      addresses.add(address);
    }
    return addresses;
  }

  private Address convertShippingAddress(OrderDTO.ShippingAddress shippingAddress) {
    if (shippingAddress == null) return null;

    Address address = new Address();
    address.setFullName(shippingAddress.getFullName());
    address.setPhoneNumber(shippingAddress.getPhoneNumber());
    address.setCity(shippingAddress.getProvinceName());
    address.setDistrict(shippingAddress.getDistrictName());
    address.setAddress1(shippingAddress.getFullAddress());

    return address;
  }

  private List<OrderLineItem> convertOrderItems(List<OrderDTO.OrderItem> items) {
    if (items == null) return new ArrayList<>();

    List<OrderLineItem> orderLineItems = new ArrayList<>();
    for (OrderDTO.OrderItem item : items) {
      OrderLineItem orderLineItem = new OrderLineItem();
      orderLineItem.setQuantity(item.getQuantity() != null ? item.getQuantity() : null);
      orderLineItem.setDiscountAmount(
          item.getTotalDiscount() != null ? item.getTotalDiscount() : null);
      orderLineItem.setVariantName(
          item.getVariationInfo() != null ? item.getVariationInfo().getName() : null);
      String sku = item.getVariationInfo() != null ? item.getVariationInfo().getBarcode() : null;
      orderLineItem.setBarcode(sku);
      orderLineItem.setSku(sku);
      orderLineItem.setPrice(
          item.getVariationInfo() != null
              ? (item.getVariationInfo().getRetailPrice() != null
                  ? item.getVariationInfo().getRetailPrice()
                  : BigDecimal.ZERO)
              : BigDecimal.ZERO);
      SapoProduct sapoProduct = sapoProductRepository.findBySku(sku);
      if (sapoProduct != null) {
        orderLineItem.setVariantId(sapoProduct.getVariantId());
        orderLineItem.setProductId(sapoProduct.getProductId());
      } else {
        log.info("Sapo product not found for SKU: {}", sku);
      }
      orderLineItems.add(orderLineItem);
    }

    return orderLineItems;
  }
}
