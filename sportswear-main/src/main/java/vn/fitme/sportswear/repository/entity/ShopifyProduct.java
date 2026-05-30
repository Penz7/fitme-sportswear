package vn.fitme.sportswear.repository.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(
    name = "shopify_products"
//    indexes = {@Index(name = "idx_sku", columnList = "sku", unique = true)}
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

@ToString
public class ShopifyProduct extends BaseEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String sku; // Mã SKU của sản phẩm variants.sku

  @Column(name = "product_id")
  private String productId; // Mã sản phẩm product.id

  @Column(name = "variant_id")
  private String variantId; // Mã phiên bản variants.id

  @Column(name = "name", length = 500)
  private String name; // Ten sản phẩm title + "-" + variants.title

  @Column(name = "available")
  private Long available; // Số lượng có thể bán variants.available

  @Column(name = "remain")
  private Long remain; // Số lượng tồn kho variants.inventoryQuantity

  @Column(name = "retail_price")
  private BigDecimal retailPrice; // Số lượng tồn kho variants.price
}
