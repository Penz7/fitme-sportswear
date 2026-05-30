package vn.fitme.sportswear;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;
import vn.fitme.sportswear.common.thirdapp.TelegramService;
import vn.fitme.sportswear.service.BusinessAddressService;
import vn.fitme.sportswear.service.BusinessProductService;
import vn.fitme.sportswear.session.SapoSessionManager;
import vn.fitme.sportswear.util.PancakeStaticUtil;
import vn.fitme.sportswear.util.SapoStaticUtil;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties
@RequiredArgsConstructor
@Slf4j
public class SportswearApplication {
  private final PancakeStaticUtil pancakeStaticUtil;
  private final SapoStaticUtil sapoStaticUtil;
  private final SapoSessionManager sapoSessionManager;
  private final BusinessAddressService addressService;
  private final TelegramService telegramService;
  private final BusinessProductService businessProductService;
  public static void main(String[] args) {
    SpringApplication.run(SportswearApplication.class, args);
  }

  @PostConstruct
  public void init() throws Exception {
//    businessProductService.deleteShopifyProducts();
    pancakeStaticUtil.fetchShopId();
    pancakeStaticUtil.fetchWarehouseId();
    log.info(
        "Success get shopId: [{}], warehouseId: [{}]",
        PancakeStaticUtil.shopId,
        PancakeStaticUtil.warehouseId);
    long now = System.currentTimeMillis();
    sapoSessionManager.refreshSession();
    log.info("Success refresh session in: {}", System.currentTimeMillis() - now);
    sapoStaticUtil.fetchSourceId();
    sapoStaticUtil.fetchViettelPostId();
    log.info(
        "Success get sourceId: [{}], viettelPostId: [{}]",
        SapoStaticUtil.sourceId,
        SapoStaticUtil.viettelPostId);
    addressService.syncAddress();
    telegramService.sendMessage("START MONITORING: SportswearApplication");
  }
}
