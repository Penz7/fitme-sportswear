package vn.fitme.sportswear.service.shopify_v2;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.fitme.sportswear.repository.ShopifyProductRepository;
import vn.fitme.sportswear.repository.entity.ShopifyProduct;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ShopifyProductBatchSaver {
    private final ShopifyProductRepository shopifyProductRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveBatch(List<ShopifyProduct> products) {
        if (products != null && !products.isEmpty()) {
            shopifyProductRepository.saveAllAndFlush(products);
            log.info("[saveBatch] Saved {} Shopify products", products.size());
        }
    }
}
