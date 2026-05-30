package vn.fitme.sportswear.common;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.function.Supplier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.session.SapoSessionManager;

@Service
@RequiredArgsConstructor
@Slf4j
public class SapoApi {

  private final SapoSessionManager sessionManager;

  public <T> ResponseEntity<T> executeWithRetry(Supplier<ResponseEntity<T>> apiCall)
      throws RuntimeException {
    int maxRetry = 3;
    int delayMillis = 1000;

    for (int i = 0; i < maxRetry; i++) {
      try {
        ResponseEntity<T> response = apiCall.get();

        if (response.getStatusCode().is2xxSuccessful()) {
          return response;
        } else if (response.getStatusCode() == HttpStatus.UNAUTHORIZED) {
          log.info("Received 401 Unauthorized, refreshing session...");
          sessionManager.refreshSession();
        } else if (response.getStatusCode().is5xxServerError()) {
          log.warn(
              "Server error with is5xxServerError: {} - retry {}/{}",
              response.getStatusCode(),
              i + 1,
              maxRetry);
          Thread.sleep(delayMillis);
        } else {
          return response;
        }

      } catch (HttpClientErrorException.Unauthorized ex) {
        log.info("Received 401 Unauthorized exception, refreshing session...");
        sessionManager.refreshSession();
      } catch (HttpServerErrorException ex) {
        log.warn(
            "Server error with HttpServerErrorException: {} - retry {}/{}",
            ex.getStatusCode(),
            i + 1,
            maxRetry);
        if (i < maxRetry - 1) {
          try {
            Thread.sleep(delayMillis);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Retry interrupted", ie);
          }
        } else {
          throw ex;
        }
      } catch (HttpClientErrorException ex) {
        throw ex;
      } catch (Exception e) {
        log.error("Unexpected exception during API call: {}", e.getMessage(), e);
        throw new RuntimeException(e);
      }
    }
    throw new IllegalArgumentException("Failed after " + maxRetry + " retries");
  }

  public <T> T exchange(
      String basePath, HttpMethod method, HttpEntity<?> requestEntity, Class<T> responseType) {
    UriComponentsBuilder builder =
        UriComponentsBuilder.newInstance()
            .scheme("https")
            .host("fitme-sportswear.mysapogo.com")
            .path(basePath);

    return this.executeWithRetry(
            () ->
                sessionManager
                    .getRestTemplate()
                    .exchange(builder.build().toUriString(), method, requestEntity, responseType))
        .getBody();
  }
}
