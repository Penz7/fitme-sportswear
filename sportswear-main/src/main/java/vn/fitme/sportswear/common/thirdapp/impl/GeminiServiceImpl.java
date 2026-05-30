package vn.fitme.sportswear.common.thirdapp.impl;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.common.thirdapp.GeminiService;
import vn.fitme.sportswear.common.thirdapp.config.GeminiProperties;

@Service
@Slf4j
public class GeminiServiceImpl implements GeminiService {
  @Autowired private GeminiProperties geminiProperties;

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(10))
          .version(HttpClient.Version.HTTP_2)
          .build();

  @Override
  public String generateContent(String inputAddress) {
    String API_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/"
            + geminiProperties.getModel()
            + ":generateContent?key="
            + geminiProperties.getApiKey();
    ObjectMapper mapper = new ObjectMapper();

    Map<String, Object> body =
        Map.of(
            "system_instruction",
                Map.of("parts", List.of(Map.of("text", geminiProperties.getSystemInstruction()))),
            "contents", List.of(Map.of("parts", List.of(Map.of("text", inputAddress)))));
    HttpResponse<String> response;
    try {
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(API_URL))
              .header("Content-Type", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
              .build();
      response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

      JsonNode json = mapper.readTree(response.body());
      return json.path("candidates")
          .get(0)
          .path("content")
          .path("parts")
          .get(0)
          .path("text")
          .asText();
    } catch (Exception e) {
      log.error("[generateContent] Error: {} with body: {}", e.getMessage(), body);
      return inputAddress;
    }
  }
}
