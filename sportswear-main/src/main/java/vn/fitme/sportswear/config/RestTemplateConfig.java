package vn.fitme.sportswear.config;

import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.cookie.BasicCookieStore;
import org.apache.hc.client5.http.cookie.CookieStore;
import org.apache.hc.client5.http.impl.LaxRedirectStrategy;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.*;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestTemplateConfig {
  @Bean
  public CookieStore cookieStore() {
    return new BasicCookieStore();
  }

  @Bean
  @Primary
  public RestTemplate restTemplate() {
    CookieStore cookieStore = new BasicCookieStore();
    RequestConfig requestConfig = RequestConfig.custom().setRedirectsEnabled(true).build();

    CloseableHttpClient httpClient =
        HttpClients.custom()
            .setDefaultCookieStore(cookieStore)
            .setRedirectStrategy(new LaxRedirectStrategy()) // Follow redirect like browser
            .setDefaultRequestConfig(requestConfig)
            .build();

    HttpComponentsClientHttpRequestFactory requestFactory =
        new HttpComponentsClientHttpRequestFactory();
    requestFactory.setHttpClient(httpClient);

    return new RestTemplate(requestFactory);
  }

  @Bean
  @Qualifier("pancakeApiRestTemplate")
  public RestTemplate pancakeApiRestTemplate() {
    return new RestTemplateBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .readTimeout(Duration.ofSeconds(30))
        .build();
  }
}
