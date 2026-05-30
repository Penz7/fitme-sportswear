package vn.fitme.sportswear.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Mappings;
import vn.fitme.sportswear.service.shopify.model.ShopifyLineItem;
import vn.fitme.sportswear.service.shopify_v2.dto.LineItem;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Mapper(componentModel = "spring")
public interface LineItemShopifyMapper {
  default ShopifyLineItem toShopifyLineItem(LineItem lineItem) {
    if (lineItem == null) {
      return null;
    }

    ShopifyLineItem item = new ShopifyLineItem();
    item.setId(lineItem.getId());
    item.setVariantId(lineItem.getVariantId() != null ? String.valueOf(lineItem.getVariantId()) : null);
    item.setTitle(lineItem.getTitle());
    item.setQuantity(lineItem.getQuantity() != null ? lineItem.getQuantity() : 0);
    item.setPrice(lineItem.getPrice() != null ? new BigDecimal(lineItem.getPrice()) : BigDecimal.ZERO);
    item.setGrams(lineItem.getGrams() != null ? lineItem.getGrams() : 0);
    item.setSku(lineItem.getSku());
    item.setVariantTitle(lineItem.getVariantTitle());
    item.setVendor(lineItem.getVendor());
    item.setProductId(lineItem.getProductId() != null ? String.valueOf(lineItem.getProductId()) : null);
    item.setRequiresShipping(Boolean.TRUE.equals(lineItem.getRequiresShipping()));
    item.setTaxable(Boolean.TRUE.equals(lineItem.getTaxable()));
    item.setGiftCard(Boolean.TRUE.equals(lineItem.getGiftCard()));
    item.setName(lineItem.getName());
    item.setVariantInventoryManagement(lineItem.getVariantInventoryManagement());
    item.setFulfillableQuantity(lineItem.getFulfillableQuantity() != null ? lineItem.getFulfillableQuantity() : 0);
    item.setTotalDiscount(lineItem.getTotalDiscount() != null ? new BigDecimal(lineItem.getTotalDiscount()) : BigDecimal.ZERO);
    item.setFulfillmentService(lineItem.getFulfillmentService());
    item.setFulfillmentStatus(null);
    item.setTaxLines(new ArrayList<>());

    return item;
  }

  List<ShopifyLineItem> toShopifyLineItemList(List<LineItem> lineItems);
}
