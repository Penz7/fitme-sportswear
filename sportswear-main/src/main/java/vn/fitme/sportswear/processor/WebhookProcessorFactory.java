package vn.fitme.sportswear.processor;

import org.springframework.stereotype.Component;
import vn.fitme.sportswear.processor.impl.DefaultWebhookProcessor;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class WebhookProcessorFactory {

  private final Map<String, WebhookProcessor> processorMap;
  private final WebhookProcessor defaultProcessor = new DefaultWebhookProcessor();

  public WebhookProcessorFactory(List<WebhookProcessor> processors) {
    this.processorMap =
        processors.stream().collect(Collectors.toMap(WebhookProcessor::getEventType, p -> p));
  }

  public WebhookProcessor getProcessor(String eventType) {
    return processorMap.getOrDefault(eventType, defaultProcessor);
  }
}
