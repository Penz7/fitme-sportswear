package vn.fitme.sportswear.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.fitme.sportswear.repository.entity.ShopifyOrderMapping;

@Repository
public interface ShopifyOrderMappingRepository extends JpaRepository<ShopifyOrderMapping, Long> {
  ShopifyOrderMapping findBySapoOrderId(String sapoOrderId);

  ShopifyOrderMapping findByShopifyOrderId(String shopifyOrderId);
}
