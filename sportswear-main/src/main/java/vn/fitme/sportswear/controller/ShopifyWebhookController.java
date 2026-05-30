package vn.fitme.sportswear.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.service.shopify_v2.ShopifyWebhookService;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@RestController
@RequiredArgsConstructor
@RequestMapping("/webhooks")
@Slf4j
public class ShopifyWebhookController {
  private final ShopifyWebhookService shopifyWebhookService;

  @Value("${app.config.shopify.webhook-secret}")
  private String shopifyWebhookSecret;

  private static final String HMAC_ALGORITHM = "HmacSHA256";
  private static final String X_SHOPIFY_HMAC = "X-Shopify-Hmac-Sha256";
  private final Executor executor = Executors.newFixedThreadPool(10);

  @PostMapping("/order")
  public ResponseEntity<String> handleOrderWebhook(
      @RequestHeader(value = X_SHOPIFY_HMAC, required = false) String hmacHeader,
      @RequestBody String payload) {

    if (verifyHmac(hmacHeader, payload)) {
      CompletableFuture.runAsync(
              () -> {
                try {
                  shopifyWebhookService.handleOrderWebhook(payload);
                } catch (Exception e) {
                  log.error("[runAsync] Error processing webhook asynchronously", e);
                }
              },
              executor);
      return ResponseEntity.ok("Webhook received");
    } else {
      log.error("[handleOrderWebhook]❌ Invalid HMAC signature. Payload: {}", payload);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
    }
  }

  @PostMapping("/product")
  public ResponseEntity<String> handleProductWebhook(
      @RequestHeader(value = X_SHOPIFY_HMAC, required = false) String hmacHeader,
      @RequestBody String payload) {

    if (verifyHmac(hmacHeader, payload)) {
      log.info("[handleProductWebhook] ✅ Webhook verified. Payload: {}", payload);

      // TODO: Parse JSON nếu cần
      return ResponseEntity.ok("Webhook received");
    } else {
      log.error("[handleProductWebhook]❌ Invalid HMAC signature. Payload: {}", payload);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
    }
  }

  @PostMapping("/fulfillment")
  public ResponseEntity<String> handleFulfillmentWebhook(
      @RequestHeader(value = X_SHOPIFY_HMAC, required = false) String hmacHeader,
      @RequestBody String payload) {

    if (verifyHmac(hmacHeader, payload)) {
      log.info("[handleFulfillmentWebhook] ✅ Webhook verified. Payload: {}", payload);

      // TODO: Parse JSON nếu cần
      return ResponseEntity.ok("Webhook received");
    } else {
      log.error("[handleFulfillmentWebhook]❌ Invalid HMAC signature. Payload: {}", payload);
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
    }
  }

  private boolean verifyHmac(String hmac, String data) {
    try {
      SecretKeySpec keySpec = new SecretKeySpec(shopifyWebhookSecret.getBytes(), HMAC_ALGORITHM);
      Mac mac = Mac.getInstance(HMAC_ALGORITHM);
      mac.init(keySpec);
      byte[] hashBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
      String calculated = Base64.getEncoder().encodeToString(hashBytes);
      return calculated.equals(hmac);
    } catch (Exception e) {
      log.error("[verifyHmac] Error verifying HMAC: {}", e.getMessage());
      return false;
    }
  }
}
