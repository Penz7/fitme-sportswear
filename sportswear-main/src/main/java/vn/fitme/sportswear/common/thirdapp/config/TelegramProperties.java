package vn.fitme.sportswear.common.thirdapp.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@ConfigurationProperties(prefix = "third.telegram")
@Data
@Component
public class TelegramProperties {
  private String token;
  private String chatId;
}
