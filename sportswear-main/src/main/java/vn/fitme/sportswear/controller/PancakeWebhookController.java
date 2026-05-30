package vn.fitme.sportswear.controller;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.processor.WebhookProcessor;
import vn.fitme.sportswear.processor.WebhookProcessorFactory;
import vn.fitme.sportswear.util.EventTypeResolver;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/webhook")
@Slf4j
public class PancakeWebhookController {
  private final WebhookProcessorFactory processorFactory;
  private final EventTypeResolver eventTypeResolver;
  private final Executor executor = Executors.newFixedThreadPool(50);

  @SneakyThrows
  @PostMapping
  public ResponseEntity<Void> handleWebhook(
      @RequestBody String payload) {

    CompletableFuture.runAsync(
        () -> {
          try {
            JsonNode jsonPayload = eventTypeResolver.parsePayload(payload);
            String eventType = eventTypeResolver.resolveEventType(jsonPayload);
            WebhookProcessor processor = processorFactory.getProcessor(eventType);
            processor.process(jsonPayload);
          } catch (Exception e) {
            log.error("[runAsync] Error processing webhook asynchronously", e);
          }
        },
        executor);

    return ResponseEntity.ok().build();
  }
}
