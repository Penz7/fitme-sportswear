package vn.fitme.sportswear.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.constant.enums.OrderType;
import vn.fitme.sportswear.service.BusinessLogService;
import vn.fitme.sportswear.service.BusinessOrderService;
import vn.fitme.sportswear.service.BusinessProductService;

import java.util.Map;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@RequiredArgsConstructor
@Slf4j
public class BusinessScheduler {
  @Value("${app.config.enable-scheduler:false}")
  private boolean enableScheduler;

  private static final long FIXED_DELAY = 10000;

  private final BusinessOrderService orderService;
  private final BusinessLogService logService;
  private final BusinessProductService productService;
  private final Map<String, AtomicBoolean> taskStatus = new ConcurrentHashMap<>();
  // Định nghĩa tên task
  private static final String TASK_SYNC_PLACED_ORDERS = "syncPlacedOrders";
  private static final String TASK_SYNC_APPROVED_ORDERS = "syncApprovedOrders";
  private static final String TASK_SYNC_PACKED_ORDERS = "syncPackedOrders";
  private static final String TASK_SYNC_SHIPPED_ORDERS = "syncShippedOrders";
  private static final String TASK_SYNC_COMPLETED_ORDERS = "syncCompletedOrders";
  private static final String TASK_SYNC_RETURNING_ORDERS = "syncReturningOrders";
  private static final String TASK_SYNC_RETURNED_ORDERS = "syncReturnedOrders";
  private static final String TASK_SYNC_RECEIVED_ORDERS = "syncReceivedOrders";
  private static final String TASK_SYNC_PAID_ORDERS = "syncPaidOrders";
  private static final String TASK_SYNC_CANCELED_ORDERS = "syncCanceledOrders";
  private static final String TASK_SYNC_PRODUCTS = "syncProducts";
  private static final String TASK_SYNC_BY_SAPO_LOGS = "syncBySapoLogs";
  private static final String TASK_SYNC_CANCELED_SHOPIFY_ORDERS = "syncCanceledShopifyOrders";
  private static final String PREFIX_PANCAKE = "AUTO_PANCAKE";
  private static final String PREFIX_SHOPIFY = "AUTO_SHOPIFY";

  // Chạy sau mỗi 10 giây sau khi task trước hoàn thành
  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncPackedOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_PACKED_ORDERS,
        () -> orderService.processTopOrders(OrderType.PACKED, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncShippedOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_SHIPPED_ORDERS,
        () -> orderService.processTopOrders(OrderType.SHIPPED, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncCompletedOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_COMPLETED_ORDERS,
        () -> orderService.processTopOrders(OrderType.COMPLETED, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncCanceledOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_CANCELED_ORDERS,
        () -> orderService.processTopOrders(OrderType.CANCELED, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncReturningOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_RETURNING_ORDERS,
        () -> orderService.processTopOrders(OrderType.RETURNING, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncReturnedOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_RETURNED_ORDERS,
        () -> orderService.processTopOrders(OrderType.RETURNED, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncReceivedOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_RECEIVED_ORDERS,
        () -> orderService.processTopOrders(OrderType.RECEIVED, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncPaidOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_PAID_ORDERS, () -> orderService.processTopOrders(OrderType.PAID, PREFIX_PANCAKE));
  }

  @Scheduled(fixedDelay = FIXED_DELAY)
  public void syncCanceledShopifyOrders() {
    if (!enableScheduler) return;
    runTask(
        TASK_SYNC_CANCELED_SHOPIFY_ORDERS,
        () -> orderService.processTopOrders(OrderType.CANCELED, PREFIX_SHOPIFY));
  }

  // Chạy mỗi 20 phút (vào phút 00, 20, 40)
  @Scheduled(cron = "0 */20 * * * *")
  public void syncProducts() {
    if (!enableScheduler) return;
    runTask(TASK_SYNC_PRODUCTS, productService::syncProducts);
  }

  @Scheduled(fixedDelay = 5000)
  public void handleBySapoLogs() {
    if (!enableScheduler) return;
    runTask(TASK_SYNC_BY_SAPO_LOGS, logService::handleBySapoLogs);
  }

  public void triggerManualSyncProducts() {
    runTask(TASK_SYNC_PRODUCTS, productService::syncProducts);
  }

  private void runTask(String taskName, Runnable task) {
    taskStatus.putIfAbsent(taskName, new AtomicBoolean(false));
    AtomicBoolean isRunning = taskStatus.get(taskName);

    if (!isRunning.compareAndSet(false, true)) {
      log.warn("⚠️ Task [{}] đang chạy, bỏ qua lần gọi mới.", taskName);
      return;
    }

    try {
      long start = System.currentTimeMillis();
      task.run();
      long duration = System.currentTimeMillis() - start;
      if (TASK_SYNC_PRODUCTS.equals(taskName)) {
        log.info(
            "================ Hoàn thành task [{}] trong {} s ================",
            taskName,
            duration / 1000);
      }
    } catch (Exception e) {
      log.error("❌ Lỗi khi chạy task [{}]: {}", taskName, e.getMessage(), e);
    } finally {
      isRunning.set(false);
    }
  }
}
