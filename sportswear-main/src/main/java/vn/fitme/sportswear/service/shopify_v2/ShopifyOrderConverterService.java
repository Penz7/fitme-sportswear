package vn.fitme.sportswear.service.shopify_v2;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.common.thirdapp.GeminiService;
import vn.fitme.sportswear.constant.enums.OrderStatusSapo;
import vn.fitme.sportswear.repository.SapoProductRepository;
import vn.fitme.sportswear.repository.entity.SapoProduct;
import vn.fitme.sportswear.service.sapo.order.dto.*;
import vn.fitme.sportswear.service.shopify_v2.dto.LineItem;
import vn.fitme.sportswear.util.DynamicTableManagerUtil;
import vn.fitme.sportswear.util.SapoStaticUtil;
import vn.fitme.sportswear.util.StringUtil;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopifyOrderConverterService {

  private final SapoProductRepository sapoProductRepository;
  private final GeminiService geminiService;

  public Order convertOrderDTOToOrder(vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {
    if (orderDTO == null) return null;

    Order order = new Order();
    order.setTotal(
        orderDTO.getTotalPrice() != null ? Double.valueOf(orderDTO.getTotalPrice()) : null);
    order.setNote(orderDTO.getName());
    order.setTags(new ArrayList<>());
    order.setShippingAddress(convertShippingAddress(orderDTO));
    order.setEmail(orderDTO.getEmail());
    order.setPhoneNumber(
        StringUtil.normalizePhone(
            StringUtil.NVL(
                orderDTO.getShippingAddress().getPhone(),
                orderDTO.getBillingAddress().getPhone(),
                orderDTO.getCustomer().getDefaultAddress().getPhone())));
    order.setCustomerData(convertCustomerData(orderDTO));
    order.setOrderLineItems(convertOrderItems(orderDTO));
    order.setStatus(OrderStatusSapo.DAT_HANG.getValue());
    order.setSourceId(Long.valueOf(SapoStaticUtil.sourceId));
    return order;
  }

  public Order convertOrderDTOToOrder(
      Order order, vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {
    if (orderDTO == null) return null;

    order.setTotal(
        orderDTO.getTotalPrice() != null ? Double.valueOf(orderDTO.getTotalPrice()) : null);
    order.setTags(new ArrayList<>());
    order.setShippingAddress(convertShippingAddress(orderDTO));
    order.setNote(order.getShippingAddress().getAddress1());
    order.setEmail(orderDTO.getEmail());
    //    order.setDeliveryFee(
    //        new DeliveryFee(
    //            null,
    //            "Phí giao hàng khác",
    //            orderDTO.getTotalPrice() - Long.parseLong(orderDTO.getSubtotalPrice())));
    order.setPhoneNumber(
        StringUtil.normalizePhone(
            StringUtil.NVL(
                orderDTO.getShippingAddress().getPhone(),
                orderDTO.getBillingAddress().getPhone(),
                orderDTO.getCustomer().getDefaultAddress().getPhone())));
    order.setCustomerData(convertCustomerData(orderDTO));
    order.setOrderLineItems(convertOrderItems(orderDTO));
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
    shipment.setFreightPayer("shop"); // "shop" : "customer"
    fulfillments.getFirst().setShipment(shipment);
    order.setFulfillments(fulfillments);
    return order;
  }

  private CustomerData convertCustomerData(
      vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {
    CustomerData customerData = new CustomerData();
    customerData.setName(orderDTO.getCustomer().getFirstName());
    customerData.setTags(new ArrayList<>());
    customerData.setAddresses(List.of(convertBaseAddress(orderDTO)));

    return customerData;
  }

  private Address convertShippingAddress(
      vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {
    return convertBaseAddress(orderDTO);
  }

  private Address convertBaseAddress(vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {

    Address address = new Address();
    address.setPhoneNumber(
        StringUtil.normalizePhone(
            StringUtil.NVL(
                orderDTO.getShippingAddress().getPhone(),
                orderDTO.getBillingAddress().getPhone(),
                orderDTO.getCustomer().getDefaultAddress().getPhone())));
    address.setFullName(
        StringUtil.NVL(
            orderDTO.getShippingAddress().getFirstName(),
            orderDTO.getBillingAddress().getFirstName(),
            orderDTO.getCustomer().getFirstName()));
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
    return address;
  }

  private List<OrderLineItem> convertOrderItems(
      vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {
    List<LineItem> items = orderDTO.getLineItems();
    if (items == null) return new ArrayList<>();

    List<OrderLineItem> orderLineItems = new ArrayList<>();
    for (LineItem item : items) {
      OrderLineItem orderLineItem = new OrderLineItem();
      orderLineItem.setQuantity(item.getQuantity() != null ? item.getQuantity() : null);
      orderLineItem.setDiscountAmount(
          item.getTotalDiscount() != null ? Double.valueOf(item.getTotalDiscount()) : null);
      orderLineItem.setVariantName(item.getName());
      String sku = item.getSku();
      orderLineItem.setBarcode(sku);
      orderLineItem.setSku(sku);
      orderLineItem.setPrice(item.getPrice() != null ? new BigDecimal(item.getPrice()) : null);
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
