package vn.fitme.sportswear.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.fitme.sportswear.repository.entity.OrderMapping;

@Repository
public interface OrderMappingRepository extends JpaRepository<OrderMapping, Long> {
  OrderMapping findBySapoOrderId(String sapoOrderId);
  OrderMapping findByPancakeOrderId(String pancakeOrderId);
}
