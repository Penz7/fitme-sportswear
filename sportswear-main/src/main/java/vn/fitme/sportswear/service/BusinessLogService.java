package vn.fitme.sportswear.service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.repository.entity.*;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.sapo.logs.dto.Event;
import vn.fitme.sportswear.service.sapo.logs.response.LogResponse;
import vn.fitme.sportswear.service.sapo.order.response.OrderResponse;
import vn.fitme.sportswear.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Getter
public class BusinessLogService {
  @Value("${app.config.enable-create-order-in-pancake:false}")
  private boolean enableCreateOrderInPancake;

  @Value("${app.config.enable-sync-address:false}")
  private boolean enableSyncAddress;

  private final SapoService sapoService;

  private final BusinessOrderService businessOrderService;

  private final Set<Long> cachedIds = ConcurrentHashMap.newKeySet(); // thread-safe
  private final Duration expireDuration = Duration.ofHours(1);
  private final Map<Long, Instant> idTimestamps = new ConcurrentHashMap<>();
  private final ExecutorService executor = Executors.newFixedThreadPool(2);

  public void handleBySapoLogs() {
    LogResponse logResponse = sapoService.getLogSapo().fetchLogs(1, 100);
    Instant now = Instant.now();
    // 1. Xóa các ID đã cũ (hết hạn)
    idTimestamps
        .entrySet()
        .removeIf(entry -> Duration.between(entry.getValue(), now).compareTo(expireDuration) > 0);
    // 2. Lọc ra các ID mới
    List<Long> newIds =
        logResponse.getIds().stream().filter(id -> !cachedIds.contains(id)).toList();
    // 3. Nếu không có ID mới thì bỏ qua
    if (newIds.isEmpty()) return;
    // 4. Extract các logs tương ứng với ID mới
    List<Event> newEvents =
        logResponse.getLogs().stream().filter(event -> newIds.contains(event.getId())).toList();
    List<String> newOrderIds = extractOrderIds(newEvents);
    // 5. Xử lý các orderId mới
    updateBySapoLogs(newOrderIds);
    // 6. Cập nhật cache
    newIds.forEach(
        id -> {
          cachedIds.add(id);
          idTimestamps.put(id, now);
        });
  }

  public List<String> extractOrderIds(List<Event> events) {
    return events.stream()
        .filter(event -> event.getUri() != null && event.getUri().contains("orders"))
        .map(this::extractOrderId)
        .filter(Objects::nonNull)
        .distinct()
        .collect(Collectors.toList());
  }

  private String extractOrderId(Event event) {
    String uri = event.getUri();

    if (uri.contains("orders.json")) {
      return event.getRootId() != null ? event.getRootId().toString() : null;
    }

    int ordersIndex = uri.indexOf("/orders/");
    if (ordersIndex != -1) {
      int start = ordersIndex + "/orders/".length();
      int end = uri.indexOf("/", start); // tìm dấu / tiếp theo
      if (end == -1) {
        end = uri.length(); // nếu không có "/" tiếp theo, lấy tới hết chuỗi
      }
      String orderId = uri.substring(start, end);
      if (orderId.matches("\\d+")) { // đảm bảo đúng là số
        return orderId;
      }
    }
    return null;
  }

  public void updateBySapoLogs(List<String> sapoOrderIds) {
    if (sapoOrderIds.isEmpty()) {
      return;
    }
    OrderResponse orderResponse = sapoService.getOrderSapo().fetchOrders(sapoOrderIds);
    orderResponse
        .getOrders()
        .forEach(order -> businessOrderService.createOrUpdateOrder(null, order, null));
  }
}
