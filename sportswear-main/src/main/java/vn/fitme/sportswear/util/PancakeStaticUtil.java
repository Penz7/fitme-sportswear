package vn.fitme.sportswear.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.PancakeApi;

import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class PancakeStaticUtil {
  private final PancakeApi pancakeApi;
  public static String shopId;
  public static String warehouseId;

  private String getShopId() {
    String url = UriComponentsBuilder.fromUriString("/shops").toUriString();
    Object responseData =
        pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode rootNode = objectMapper.convertValue(responseData, JsonNode.class);
    shopId =
        Optional.ofNullable(rootNode.get("shops"))
            .map(shops -> shops.findValue("pages"))
            .filter(JsonNode::isArray)
            .filter(pages -> !pages.isEmpty())
            .map(pages -> pages.get(0))
            .map(page -> page.get("shop_id"))
            .map(JsonNode::asText)
            .orElse(null);
    return shopId;
  }

  // ID cửa hàng
  public String fetchShopId() {
    if (shopId == null) {
      shopId = getShopId();
    }
    return shopId;
  }

  private String getWarehouseId() {
    String url =
        UriComponentsBuilder.fromUriString("/shops/{shopId}/warehouses")
            .buildAndExpand(PancakeStaticUtil.shopId)
            .toUriString();
    Object responseData =
        pancakeApi.exchange(url, HttpMethod.GET, null, new ParameterizedTypeReference<>() {});
    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode rootNode = objectMapper.convertValue(responseData, JsonNode.class);
    warehouseId =
        Optional.ofNullable(rootNode)
            .map(node -> node.get("data"))
            .filter(JsonNode::isArray)
            .filter(array -> !array.isEmpty())
            .map(array -> array.get(0))
            .map(node -> node.get("id"))
            .map(JsonNode::asText)
            .orElse(null);
    return warehouseId;
  }

  // ID kho hàng
  public String fetchWarehouseId() {
    if (warehouseId == null) {
      warehouseId = getWarehouseId();
    }
    return warehouseId;
  }
}
