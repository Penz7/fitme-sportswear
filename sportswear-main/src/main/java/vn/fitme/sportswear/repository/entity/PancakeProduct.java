package vn.fitme.sportswear.repository.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "pancake_products",
    indexes = {@Index(name = "idx_sku", columnList = "sku", unique = true)})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

@ToString
public class PancakeProduct extends BaseEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String sku; // Mã SKU của sản phẩm

  @Column(name = "product_id")
  private String productId; // Mã sản phẩm

  @Column(name = "variant_id")
  private String variantId; // Mã phiên bản

  @Column(name = "name", length = 500)
  private String name; // Ten sản phẩm

  @Column(name = "available")
  private Integer available; // Số lượng có thể bán

  @Column(name = "remain")
  private Integer remain; // Số lượng tồn kho

  @Column(name = "retail_price")
  private Double retailPrice; // Số lượng tồn kho

  @Column(name = "warehouse_id")
  private String warehouseId; // Mã kho hàng, nếu có
}
