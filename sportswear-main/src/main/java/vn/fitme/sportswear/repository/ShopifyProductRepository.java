package vn.fitme.sportswear.repository;

import jakarta.transaction.Transactional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.fitme.sportswear.repository.entity.ShopifyProduct;
import vn.fitme.sportswear.service.shopify_v2.dto.SapoShopifyDTO;

@Repository
public interface ShopifyProductRepository extends JpaRepository<ShopifyProduct, Long> {
  ShopifyProduct findBySku(String sku);

  @Query(
"""
    SELECT new vn.fitme.sportswear.service.shopify_v2.dto.SapoShopifyDTO(
        p.id,
        p.variantId,
        s.available,
        p.available,
        s.updatedAt,
        p.updatedAt
    )
    FROM SapoProduct s
    JOIN ShopifyProduct p ON s.sku = p.sku
""")
  List<SapoShopifyDTO> findSapoShopifyProducts();

  @Modifying
  @Transactional
  @Query(
"""
    UPDATE ShopifyProduct sp
    SET sp.available = :available, sp.updatedBy = 'SAPO'
    WHERE sp.id = :id
""")
  void updateAvailableById(@Param("id") Long id, @Param("available") Long available);

  @Query(
          """
              SELECT p
              FROM ShopifyProduct p
              JOIN SapoProduct s ON s.name = p.name
          """)
  List<ShopifyProduct> findByInSapo();

  @Modifying
  @Transactional
  void deleteAllByProductIdIn(List<String> productIds);
}
