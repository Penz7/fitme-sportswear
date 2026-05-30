package vn.fitme.sportswear.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class EventTypeResolver {

  private final ObjectMapper objectMapper;

  public EventTypeResolver(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public String resolveEventType(JsonNode payload) {
    if (payload.has("type")
        && "orders".equals(payload.path("type").asText())
        && "create".equals(payload.path("event_type").asText())) {
      return "order_created";
    }
    if (payload.has("type")
        && "orders".equals(payload.path("type").asText())
        && "update".equals(payload.path("event_type").asText())) {
      return "order_updated";
    }
    if (payload.has("stockInbound")) {
      return "stock_inbound";
    }
    if (payload.has("inventory")) {
      return "inventory_check";
    }
    return "unknown"; // fallback
  }

  public JsonNode parsePayload(String rawPayload) {
    try {
      return objectMapper.readTree(rawPayload);
    } catch (Exception e) {
      throw new RuntimeException("Invalid JSON payload", e);
    }
  }
}
