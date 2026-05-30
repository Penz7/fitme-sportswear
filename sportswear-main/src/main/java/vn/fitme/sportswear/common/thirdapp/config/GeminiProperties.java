package vn.fitme.sportswear.common.thirdapp.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@ConfigurationProperties(prefix = "third.gemini")
@Data
@Component
public class GeminiProperties {
  private String model;
  private String apiKey;
  private String systemInstruction;
}
