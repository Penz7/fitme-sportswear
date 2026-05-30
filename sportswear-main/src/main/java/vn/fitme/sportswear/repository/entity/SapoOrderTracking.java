package vn.fitme.sportswear.repository.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import vn.fitme.sportswear.constant.enums.OrderType;
import vn.fitme.sportswear.converter.StringListConverter;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "sapo_orders_tracking")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class SapoOrderTracking {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "order_id", nullable = false, length = 4000)
  @Convert(converter = StringListConverter.class)
  private List<String> orderId;

  @Column(name = "type", nullable = false)
  private String type;

  @Column(name = "last_update", nullable = false)
  private LocalDateTime lastUpdate;

  public SapoOrderTracking(List<String> orderId, String type, LocalDateTime lastUpdate) {
    this.orderId = orderId;
    this.type = type;
    this.lastUpdate = lastUpdate;
  }
}
