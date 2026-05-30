package vn.fitme.sportswear.processor.impl;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import vn.fitme.sportswear.processor.WebhookProcessor;

@Slf4j
public class DefaultWebhookProcessor implements WebhookProcessor {

  @Override
  public void process(JsonNode payload) {
//    log.info("[DefaultWebhookProcessor] No processor found for this event. Payload: \n{}", payload);
  }

  @Override
  public String getEventType() {
    return "default";
  }
}
