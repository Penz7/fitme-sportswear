package vn.fitme.sportswear.service.sapo;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.fitme.sportswear.repository.SapoProductRepository;
import vn.fitme.sportswear.repository.entity.SapoProduct;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class SapoProductBatchSaver {

  private final SapoProductRepository sapoProductRepository;

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void saveBatch(List<SapoProduct> products) {
    if (products != null && !products.isEmpty()) {
      sapoProductRepository.saveAllAndFlush(products);
      log.info("[saveBatch] Saved {} Sapo products", products.size());
    }
  }
}
