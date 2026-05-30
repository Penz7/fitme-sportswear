package vn.fitme.sportswear.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vn.fitme.sportswear.repository.entity.SapoProduct;

import java.util.List;

@Repository
public interface SapoProductRepository extends JpaRepository<SapoProduct, Long> {
  SapoProduct findBySku(String sku);

  @Query(
"""
    SELECT s FROM SapoProduct s
    WHERE s.sku NOT IN (SELECT p.sku FROM PancakeProduct p)
""")
  List<SapoProduct> findSapoProductsNotInPancake();

  @Query(
          """
              SELECT s FROM SapoProduct s
              WHERE s.sku NOT IN (SELECT p.sku FROM ShopifyProduct p)
          """)
  List<SapoProduct> findSapoProductsNotInShopify();
}
