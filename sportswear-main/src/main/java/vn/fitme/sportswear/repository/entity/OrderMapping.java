package vn.fitme.sportswear.repository.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import lombok.*;

import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "order_mapping")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class OrderMapping {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String sapoOrderId;
  private String pancakeOrderId;

  private String sapoStatus;
  private String sapoPackedStatus;
  private String sapoFulfillmentStatus;
  private String sapoReceivedStatus;
  private String sapoPaymentStatus;
  private String sapoReturnStatus;

  private Integer pancakeStatus;
  private String pancakeStatusDescription;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public OrderMapping(String sapoOrderId, String pancakeOrderId, LocalDateTime createdAt) {
    this.sapoOrderId = sapoOrderId;
    this.pancakeOrderId = pancakeOrderId;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
  }
}
