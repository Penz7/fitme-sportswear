package vn.fitme.sportswear.processor;

import com.fasterxml.jackson.databind.JsonNode;

public interface WebhookProcessor {
  void process(JsonNode payload);

  String getEventType(); // để mapping theo event type
}
