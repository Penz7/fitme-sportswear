package vn.fitme.sportswear.mapper;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.fitme.sportswear.common.thirdapp.GeminiService;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.order.dto.Order;
import vn.fitme.sportswear.service.sapo.order.dto.OrderLineItem;
import vn.fitme.sportswear.service.sapo.order.fulfilment.*;
import vn.fitme.sportswear.util.DynamicTableManagerUtil;
import vn.fitme.sportswear.util.StringUtil;

@Component
@RequiredArgsConstructor
@Slf4j
public class FulfillmentShopifyMapper {
  private final SapoService sapoService;
  private final GeminiService geminiService;

  public Fulfillment convert(
      vn.fitme.sportswear.service.shopify_v2.dto.Order order, Order sapoOrder) throws Exception {
    if (order == null) return null;

    Fulfillment fulfillment = new Fulfillment();

    // Map billing address
    Address billingAddress = convertBaseAddress(order);

    // Map shipping address
    Address shippingAddress = convertBaseAddress(order);


    // Map notes
    fulfillment.setNotes("Có vấn đề gọi shop, không tự ý hủy đơn, Gọi khách trước khi giao");

    fulfillment.setDeliveryType("courier");

    // Map operation system
    fulfillment.setOperationSystem("web"); // hoặc custom theo order.getOrderSources()
    List<OrderLineItem> orderLineItems = sapoOrder.getOrderLineItems();
    // Map fulfillment line items
    List<FulfillmentLineItem> fulfillmentLineItems = new ArrayList<>();
    if (order.getLineItems() != null) {
      fulfillmentLineItems =
          order.getLineItems().stream()
              .map(
                  item -> {
                    String sku = item.getSku();
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
    shipment.setFreightPayer("shop"); // "shop" : "customer"
    shipment.setOperationSystem("web");
    shipment.setDeliveryServiceProviderId(508146L);
    shipment.setCodAmount(0L);
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
    String message = geminiService.generateContent(shippingAddress.getFullAddress());
    Map<String, Object> address =
        DynamicTableManagerUtil.findBestMatch(message);
    if (address == null) return null;
    detail.setReceiverWard(address.get("sapo_wardname").toString());
    detail.setReceiverDistrictId(Integer.parseInt(address.get("sapo_districtid").toString()));
    detail.setReceiverProvinceId(Integer.parseInt(address.get("sapo_cityid").toString()));

    shippingAddress.setWard(address.get("sapo_wardname").toString());
    shippingAddress.setDistrict(address.get("sapo_district").toString());
    shippingAddress.setCity(address.get("sapo_city").toString());

    billingAddress.setWard(address.get("sapo_wardname").toString());
    billingAddress.setDistrict(address.get("sapo_district").toString());
    billingAddress.setCity(address.get("sapo_city").toString());

    fulfillment.setShippingAddress(shippingAddress);
    fulfillment.setBillingAddress(billingAddress);

    detail.setSenderPhone("0707121868");
    detail.setSenderEmail("mathkudo@gmail.com");
    detail.setSenderFullName(billingAddress.getFullName());
    detail.setSenderAddress(
        "11/4b Phạm Văn Sáng Ấp 2, X.Xuân Thới Thượng, H.Hóc Môn, TP.Hồ Chí Minh");
    // xu ly setSenderProvinceId
    detail.setSenderProvinceId(2);
    // xu ly setSenderDistrictId
    detail.setSenderDistrictId(55);
    // xu ly setSenderWardId
    detail.setSenderWardId(947);
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
    detail.setProductQuantity(
        order.getLineItems().stream()
            .mapToInt(q -> q.getQuantity() != null ? q.getQuantity() : 0)
            .sum());
    detail.setProductWeight(300);
    detail.setProductHeight(10);
    detail.setProductWidth(10);
    detail.setProductLength(10);
    detail.setCodAmount(order.getTotalPrice());
    detail.setProductName(order.getLineItems().getFirst().getName());
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

  private Address convertBaseAddress(vn.fitme.sportswear.service.shopify_v2.dto.Order orderDTO) {
    Address address = new Address();
    address.setEmail(StringUtil.NVL(orderDTO.getContactEmail(), orderDTO.getCustomer().getEmail()));
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
    address.setFullAddress(address.getAddress1());

    return address;
  }
}
