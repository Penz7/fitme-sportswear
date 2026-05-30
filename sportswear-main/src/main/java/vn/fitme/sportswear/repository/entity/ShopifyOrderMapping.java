package vn.fitme.sportswear.repository.entity;

import jakarta.persistence.*;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "shopify_order_mapping")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ShopifyOrderMapping {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String sapoOrderId;
  private String shopifyOrderId;
  private String shopifyStatus;

  private String sapoStatus;
  private String sapoPackedStatus;
  private String sapoFulfillmentStatus;
  private String sapoReceivedStatus;
  private String sapoPaymentStatus;
  private String sapoReturnStatus;

  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public ShopifyOrderMapping(String sapoOrderId, String shopifyOrderId) {
    this.sapoOrderId = sapoOrderId;
    this.shopifyOrderId = shopifyOrderId;
    this.createdAt = LocalDateTime.now();
    this.updatedAt = LocalDateTime.now();
  }
}
