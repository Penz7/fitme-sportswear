package vn.fitme.sportswear.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.fitme.sportswear.repository.entity.PancakeProduct;
import vn.fitme.sportswear.service.pancake.product.dto.SapoPancakeDTO;

import java.util.List;

@Repository
public interface PancakeProductRepository extends JpaRepository<PancakeProduct, Long> {
  PancakeProduct findBySku(String sku);

  List<PancakeProduct> findAllBySkuIn(List<String> skus);

  @Query(
"""
    SELECT new vn.fitme.sportswear.service.pancake.product.dto.SapoPancakeDTO(
        p.id,
        p.variantId,
        p.warehouseId,
        s.available,
        p.available,
        s.updatedAt,
        p.updatedAt
    )
    FROM SapoProduct s
    JOIN PancakeProduct p ON s.sku = p.sku
""")
  List<SapoPancakeDTO> findSapoPancakeProducts();

  @Modifying
  @Transactional
  @Query(
"""
    UPDATE PancakeProduct p
    SET p.available = :available, p.updatedBy = 'SAPO'
    WHERE p.id = :id
""")
  void updateAvailableById(@Param("id") Long id, @Param("available") Integer available);
}
