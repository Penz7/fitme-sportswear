package vn.fitme.sportswear.processor.impl;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import vn.fitme.sportswear.processor.WebhookProcessor;

@Component
public class StockInboundProcessor implements WebhookProcessor {

  @Override
  public void process(JsonNode payload) {
    System.out.println("Processing Stock Inbound: " + payload);
    // Update số lượng tồn kho, ghi nhận nhập hàng
  }

  @Override
  public String getEventType() {
    return "stock_inbound";
  }
}
