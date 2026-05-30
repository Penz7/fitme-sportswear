package vn.fitme.sportswear.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.common.SapoApi;

import java.util.Map;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class SapoStaticUtil {
  private final SapoApi sapoApi;
  public static String viettelPostId;
  public static String sourceId;

  public String fetchViettelPostId() {
    if (viettelPostId == null) {
      String url =
          UriComponentsBuilder.fromUriString(
                  "/admin/delivery_service_providers/search.json?limit=1&page=1&statuses=active&query=Viettelpost")
              .toUriString();
      Object apiResponse = sapoApi.exchange(url, HttpMethod.GET, null, Object.class);
      try {
        // Convert to a Map if the object is of type Map
        if (apiResponse instanceof Map<?, ?> responseMap) {
          Object providers = responseMap.get("delivery_service_providers");

          if (providers instanceof List<?> providerList && !providerList.isEmpty()) {
            Object firstProvider = providerList.getFirst();

            // Read "id" field using Reflection
            if (firstProvider instanceof Map<?, ?> providerMap) {
              Object id = providerMap.get("id");
              viettelPostId = id != null ? id.toString() : null;
            }
          }
        }
      } catch (Exception e) {
        log.error("[fetchViettelPostId] Error: ", e);
      }
    }
    return viettelPostId;
  }

  public String fetchSourceId() {
    if (sourceId == null) {
      String url =
          UriComponentsBuilder.fromUriString("/admin/order_sources.json?&name=WebOrder")
              .toUriString();
      Object apiResponse = sapoApi.exchange(url, HttpMethod.GET, null, Object.class);
      try {
        // Convert to a Map if the object is of type Map
        if (apiResponse instanceof Map<?, ?> responseMap) {
          Object sources = responseMap.get("order_sources");
          if (sources instanceof List<?> sourceList && !sourceList.isEmpty()) {
            Object firstSource = sourceList.getFirst();
            // Read "id" field using Reflection
            if (firstSource instanceof Map<?, ?> sourceMap) {
              Object id = sourceMap.get("id");
              sourceId = id != null ? id.toString() : null;
            }
          }
        }
      } catch (Exception e) {
        log.error("[fetchSourceId] Error: ", e);
      }
    }
    return sourceId;
  }

}
