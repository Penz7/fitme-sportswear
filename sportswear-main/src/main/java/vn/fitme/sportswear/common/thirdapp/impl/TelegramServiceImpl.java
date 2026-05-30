package vn.fitme.sportswear.common.thirdapp.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.thirdapp.TelegramService;
import vn.fitme.sportswear.common.thirdapp.config.TelegramProperties;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class TelegramServiceImpl implements TelegramService {
  @Autowired private TelegramProperties telegramProperties;

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(10))
          .version(HttpClient.Version.HTTP_2)
          .build();
  private static final int MAX_LENGTH = 4000;

  @Override
  public void sendMessage(String message) {
    try {
      List<String> parts = splitMessage(message, MAX_LENGTH);

      for (String part : parts) {
        URI uri =
            UriComponentsBuilder.fromUriString("https://api.telegram.org")
                .pathSegment("bot" + telegramProperties.getToken(), "sendMessage")
                .queryParam("chat_id", telegramProperties.getChatId())
                .queryParam("text", part)
                .build()
                .toUri();

        HttpRequest request =
            HttpRequest.newBuilder().GET().uri(uri).timeout(Duration.ofSeconds(10)).build();

        HTTP_CLIENT.sendAsync(request, HttpResponse.BodyHandlers.discarding());
      }
    } catch (Exception e) {
      log.error("[sendMessage] Failed to send Telegram message: ", e);
    }
  }

  private List<String> splitMessage(String message, int maxLength) {
    List<String> parts = new ArrayList<>();
    int length = message.length();
    for (int start = 0; start < length; start += maxLength) {
      int end = Math.min(start + maxLength, length);
      parts.add(message.substring(start, end));
    }
    return parts;
  }

  @Override
  public void sendException(String prefix, Exception e) {
    StringWriter sw = new StringWriter();
    e.printStackTrace(new PrintWriter(sw));
    String stackTrace = sw.toString();

    String message = prefix + "\n" + stackTrace;
    message = message.substring(0, Math.min(message.length(), MAX_LENGTH));
    message += "...";
    sendMessage(message);
  }
}
