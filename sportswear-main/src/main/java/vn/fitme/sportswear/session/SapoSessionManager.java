package vn.fitme.sportswear.session;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.apache.hc.client5.http.cookie.CookieStore;

@Component
@RequiredArgsConstructor
@Slf4j
public class SapoSessionManager {
  @Getter private final RestTemplate restTemplate;
  private final CookieStore cookieStore;

  @Value("${app.config.sapo.phone-number}")
  private String phoneNumber;

  @Value("${app.config.sapo.password}")
  private String password;

  @Value("${app.config.sapo.client-id}")
  private String clientId;

  @Value("${app.config.sapo.shop-domain}")
  private String shopDomain;

  private static final String LOGIN_URL = "https://accounts.sapo.vn/login";

  public void refreshSession() {
    cookieStore.clear();
    login();
    authorize();
    adminAuth();
  }

  private void login() {
    MultiValueMap<String, String> loginForm = new LinkedMultiValueMap<>();
    loginForm.add("phoneNumber", phoneNumber);
    loginForm.add("password", password);
    loginForm.add("clientId", clientId);
    loginForm.add("countryCode", "84");
    loginForm.add("isFixedDomain", "false");
    loginForm.add("Product", "pos");
    loginForm.add("suffix-domain", "mysapogo.com");

    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
    HttpEntity<MultiValueMap<String, String>> loginRequest = new HttpEntity<>(loginForm, headers);

    restTemplate.postForEntity(LOGIN_URL, loginRequest, String.class);
  }

  private void authorize() {
    HttpHeaders headers = new HttpHeaders();
    headers.add("Referer", "https://" + shopDomain + "/");
    HttpEntity<Void> request = new HttpEntity<>(headers);

    restTemplate.exchange(buildAuthorizeUrl(), HttpMethod.GET, request, String.class);
  }

  private void adminAuth() {
    HttpHeaders headers = new HttpHeaders();
    headers.add("Referer", "https://" + shopDomain + "/");
    HttpEntity<Void> request = new HttpEntity<>(headers);

    restTemplate.exchange(buildAdminAuthUrl(), HttpMethod.GET, request, String.class);
  }

  private String buildAuthorizeUrl() {
    return "https://accounts.sapo.vn/oauth/authorize"
        + "?client_id="
        + clientId
        + "&redirect_uri=https://app.sapo.vn/oauth/SapoSSOOauthCallback"
        + "&state={\"redirectUrl\" : \"http://"
        + shopDomain
        + "/admin/authorization/login?returnUrl=/\"}"
        + "&scope=profile"
        + "&response_type=code";
  }

  private String buildAdminAuthUrl() {
    return "https://" + shopDomain + "/admin/authorization/login?returnUrl=/admin";
  }
}
