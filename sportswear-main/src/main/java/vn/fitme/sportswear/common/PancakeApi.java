package vn.fitme.sportswear.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.thirdapp.TelegramService;

@Service
@Slf4j
public class PancakeApi {
  @Value("${app.config.pancake.api-key:default-value}")
  private String apiKey;

  private final RestTemplate pancakeRestTemplate;

  public PancakeApi(@Qualifier("pancakeApiRestTemplate") RestTemplate pancakeRestTemplate) {
    this.pancakeRestTemplate = pancakeRestTemplate;
  }

  public <T> T exchange(
          String basePath,
          HttpMethod method,
          HttpEntity<?> requestEntity,
          ParameterizedTypeReference<T> responseType) {

    UriComponentsBuilder builder =
            UriComponentsBuilder.newInstance()
                    .scheme("https")
                    .host("pos.pages.fm")
                    .path("/api/v1" + UriComponentsBuilder.fromUriString(basePath).build().getPath())
                    .queryParams(UriComponentsBuilder.fromUriString(basePath).build().getQueryParams())
                    .queryParam("api_key", apiKey);

    String url = builder.build().toUriString();

    int maxRetries = 3;
    int attempt = 0;
    long backoffMs = 1000;

    while (true) {
      try {
        ResponseEntity<T> response =
                pancakeRestTemplate.exchange(url, method, requestEntity, responseType);
        return response.getBody();
      } catch (Exception ex) {
        attempt++;
        log.warn("API call failed (attempt {}/{}): {}", attempt, maxRetries, ex.getMessage());

        if (attempt >= maxRetries) {
          log.error("API call failed after {} attempts: {}", maxRetries, ex.getMessage(), ex);
          throw ex;
        }

        try {
          Thread.sleep(backoffMs);
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw new RuntimeException("Retry interrupted", ie);
        }
      }
    }
  }
}
