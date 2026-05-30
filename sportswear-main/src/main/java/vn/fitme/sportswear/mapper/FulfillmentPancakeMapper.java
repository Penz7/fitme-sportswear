package vn.fitme.sportswear.mapper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.fitme.sportswear.common.thirdapp.GeminiService;
import vn.fitme.sportswear.processor.dto.OrderDTO;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.dto.OrderLineItem;
import vn.fitme.sportswear.service.sapo.order.fulfilment.*;
import vn.fitme.sportswear.util.DynamicTableManagerUtil;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static vn.fitme.sportswear.constant.AppConstant.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class FulfillmentPancakeMapper {
  private final SapoService sapoService;
  private final GeminiService geminiService;

  public Fulfillment convert(OrderDTO order, Order sapoOrder) throws Exception {
    if (order == null) return null;

    Fulfillment fulfillment = new Fulfillment();

    // Map billing address
    Address billingAddress = new Address();
    billingAddress.setFullName(order.getBillFullName());
    billingAddress.setPhoneNumber(order.getBillPhoneNumber());
    billingAddress.setEmail(order.getBillEmail());
    billingAddress.setFullAddress(
        order.getWarehouseInfo() != null ? order.getWarehouseInfo().getFullAddress() : null);
    billingAddress.setAddress1(
        order.getWarehouseInfo() != null ? order.getWarehouseInfo().getFullAddress() : null);
    fulfillment.setBillingAddress(billingAddress);

    // Map shipping address
    Address shippingAddress = new Address();
    OrderDTO.ShippingAddress shipping = order.getShippingAddress();
    if (Objects.isNull(shipping)) {
      return null;
    }
    shippingAddress.setFullName(shipping.getFullName());
    shippingAddress.setPhoneNumber(shipping.getPhoneNumber());
    shippingAddress.setFullAddress(shipping.getFullAddress());
    shippingAddress.setAddress1(shipping.getFullAddress());
    shippingAddress.setCity(shipping.getProvinceName());
    shippingAddress.setDistrict(shipping.getDistrictName());
    shippingAddress.setEmail("");
    fulfillment.setShippingAddress(shippingAddress);

    // Map notes
    fulfillment.setNotes("Có vấn đề gọi shop, không tự ý hủy đơn, Gọi khách trước khi giao");

    fulfillment.setDeliveryType("courier");

    // Map operation system
    fulfillment.setOperationSystem("web"); // hoặc custom theo order.getOrderSources()
    List<OrderLineItem> orderLineItems = sapoOrder.getOrderLineItems();
    // Map fulfillment line items
    List<FulfillmentLineItem> fulfillmentLineItems = new ArrayList<>();
    if (order.getItems() != null) {
      fulfillmentLineItems =
          order.getItems().stream()
              .map(
                  item -> {
                    String sku =
                        item.getVariationInfo() != null
                            ? item.getVariationInfo().getBarcode()
                            : null;
                    OrderLineItem ok =
                        orderLineItems.stream()
                            .filter(orderLineItem -> orderLineItem.getSku().equals(sku))
                            .findFirst()
                            .orElse(null);
                    FulfillmentLineItem lineItem = new FulfillmentLineItem();
                    lineItem.setOrderLineItemId(ok != null ? ok.getId() : null);
                    lineItem.setQuantity(item.getQuantity());
                    lineItem.setSku(sku);
                    lineItem.setProductName(ok != null ? ok.getProductName() : null);
                    lineItem.setPrice(ok != null ? ok.getPrice() : null);
                    return lineItem;
                  })
              .toList();
      fulfillment.setFulfillmentLineItems(fulfillmentLineItems);
    }

    // Shipment mapping nếu có thể
    Shipment shipment = new Shipment();
    shipment.setShippingAccountId("604003_1");
    shipment.setFreightPayer(
        order.getIsFreeShipping() != null && order.getIsFreeShipping() ? "shop" : "customer");
    shipment.setOperationSystem("web");
    shipment.setDeliveryServiceProviderId(508146L);
    shipment.setCodAmount(
        Objects.isNull(order.getCod())
            ? order.getMoneyToCollect().longValue()
            : order.getCod().longValue());
    shipment.setDeliveryFee(0L);
    shipment.setHeight(10);
    shipment.setLength(10);
    shipment.setWidth(10);
    shipment.setWeight(300);
    ShipmentDetail detail = new ShipmentDetail();
    // Set các giá trị cho detail ở đây...
    detail.setReceiverFullName(shippingAddress.getFullName());
    detail.setReceiverPhone(shippingAddress.getPhoneNumber());
    detail.setReceiverAddress(shippingAddress.getFullAddress());
    detail.setReceiverEmail(shippingAddress.getEmail());
    Map<String, Object> filters;
    List<Map<String, Object>> data;
    Map<String, Object> map;
    if (shipping.getCommuneId() == null
        || shipping.getDistrictId() == null
        || shipping.getProvinceId() == null) {
      if (shippingAddress.getFullAddress() == null) return null;
      String message = geminiService.generateContent(shippingAddress.getFullAddress());
      Map<String, Object> address = DynamicTableManagerUtil.findBestMatch(message);
      if (address == null) return null;
      detail.setReceiverWard(address.get("sapo_wardname").toString());
      detail.setReceiverDistrictId(Integer.parseInt(address.get("sapo_districtid").toString()));
      detail.setReceiverProvinceId(Integer.parseInt(address.get("sapo_cityid").toString()));
    } else {
      // xu ly setReceiverWard
      filters = Map.of(PANCAKE_ID, shipping.getCommuneId());
      data = DynamicTableManagerUtil.findAllDynamic(WARD_MAPPING, filters, "similarity ASC", 1);
      map = data.getFirst();
      detail.setReceiverWard(
          map != null && map.get("sapo_name") != null ? map.get("sapo_name").toString() : "");

      // xu ly setReceiverDistrictId
      filters = Map.of(PANCAKE_ID, shipping.getDistrictId());
      data = DynamicTableManagerUtil.findAllDynamic(DISTRICT_MAPPING, filters, "similarity ASC", 1);
      map = data.getFirst();
      detail.setReceiverDistrictId(
          map != null && map.get(SAPO_ID) != null
              ? Integer.parseInt(map.get(SAPO_ID).toString())
              : -1);
      // xu ly setReceiverProvinceId
      filters = Map.of(PANCAKE_ID, Integer.valueOf(shipping.getProvinceId()));
      data = DynamicTableManagerUtil.findAllDynamic(PROVINCE_MAPPING, filters, "similarity ASC", 1);
      map = data.getFirst();
      detail.setReceiverProvinceId(
          map != null && map.get(SAPO_ID) != null
              ? Integer.parseInt(map.get(SAPO_ID).toString())
              : -1);
    }

    detail.setSenderPhone(billingAddress.getPhoneNumber());
    detail.setSenderEmail("");
    detail.setSenderAddress(billingAddress.getFullAddress());
    detail.setSenderFullName(billingAddress.getFullName());
    // xu ly setSenderProvinceId
    filters = Map.of(PANCAKE_ID, Integer.valueOf(order.getWarehouseInfo().getProvinceId()));
    data = DynamicTableManagerUtil.findAllDynamic(PROVINCE_MAPPING, filters, "similarity ASC", 1);
    map = data.getFirst();
    detail.setSenderProvinceId(
        map != null && map.get(SAPO_ID) != null
            ? Integer.parseInt(map.get(SAPO_ID).toString())
            : -1);
    // xu ly setSenderDistrictId
    filters = Map.of(PANCAKE_ID, order.getWarehouseInfo().getDistrictId());
    data = DynamicTableManagerUtil.findAllDynamic(DISTRICT_MAPPING, filters, "similarity ASC", 1);
    map = data.getFirst();
    detail.setSenderDistrictId(
        map != null && map.get(SAPO_ID) != null
            ? Integer.parseInt(map.get(SAPO_ID).toString())
            : -1);
    // xu ly setSenderWardId
    filters = Map.of(PANCAKE_ID, order.getWarehouseInfo().getCommuneId());
    data = DynamicTableManagerUtil.findAllDynamic(WARD_MAPPING, filters, "similarity ASC", 1);
    map = data.getFirst();
    detail.setSenderWardId(
        map != null && map.get(SAPO_ID) != null
            ? Integer.parseInt(map.get(SAPO_ID).toString())
            : -1);

    List<ShipmentItem> items =
        fulfillmentLineItems.stream()
            .map(
                item -> {
                  ShipmentItem shipmentItem = new ShipmentItem();
                  shipmentItem.setProductName(item.getProductName());
                  shipmentItem.setProductPrice(item.getPrice());
                  shipmentItem.setProductQuantity(item.getQuantity());
                  return shipmentItem;
                })
            .toList();
    detail.setListItem(items);
    detail.setOrderService("VSL7");
    detail.setOrderServiceAdd("");
    detail.setProductType("HH");
    detail.setOrderPayment(3);
    detail.setOrderVoucher("");
    detail.setProductQuantity(order.getTotalQuantity());
    detail.setProductWeight(300);
    detail.setProductHeight(10);
    detail.setProductWidth(10);
    detail.setProductLength(10);
    detail.setCodAmount(order.getTotalPrice().longValue());
    detail.setProductName(items.getFirst().getProductName());
    detail.setProductDescription("");
    detail.setInventoryId(22207987L);
    detail.setOrderNote(
        "Cho xem hàng, không cho thử| Có vấn đề gọi shop, không tự ý hủy đơn, Gọi khách trước khi giao");

    ObjectMapper mapper = new ObjectMapper();
    try {
      String jsonString = mapper.writeValueAsString(detail);
      shipment.setDetail(jsonString);

    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
    Long freightAmount =
        sapoService
            .getOrderSapo()
            .getFreightAmount(
                detail.getSenderProvinceId(),
                detail.getSenderDistrictId(),
                detail.getReceiverProvinceId(),
                detail.getReceiverDistrictId(),
                shipment.getCodAmount(),
                shipment.getFreightPayer());
    shipment.setFreightAmount(freightAmount);
    fulfillment.setShipment(shipment);
    return fulfillment;
  }
}
