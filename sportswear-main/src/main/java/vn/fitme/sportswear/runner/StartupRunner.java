package vn.fitme.sportswear.runner;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import vn.fitme.sportswear.scheduler.BusinessScheduler;

@Component
@RequiredArgsConstructor
@Slf4j
public class StartupRunner {
  private final BusinessScheduler businessScheduler;

  @EventListener(ApplicationReadyEvent.class)
  public void runAfterStartup() {
    log.info("[runAfterStartup] App đã khởi động thành công. Thực thi triggerManualSyncProducts!");
    businessScheduler.triggerManualSyncProducts();
  }
}
