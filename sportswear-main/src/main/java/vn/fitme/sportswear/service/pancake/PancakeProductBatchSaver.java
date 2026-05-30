package vn.fitme.sportswear.service.pancake;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.fitme.sportswear.repository.PancakeProductRepository;
import vn.fitme.sportswear.repository.entity.PancakeProduct;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class PancakeProductBatchSaver {
  private final PancakeProductRepository pancakeProductRepository;

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void saveBatch(List<PancakeProduct> products) {
    if (products != null && !products.isEmpty()) {
      pancakeProductRepository.saveAllAndFlush(products);
      log.info("[saveBatch] Saved {} Pancake products", products.size());
    }
  }
}
