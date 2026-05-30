package vn.fitme.sportswear.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.fitme.sportswear.constant.enums.OrderType;
import vn.fitme.sportswear.repository.entity.SapoOrderTracking;

import java.util.Optional;

@Repository
public interface SapoOrderTrackingRepository extends JpaRepository<SapoOrderTracking, Long> {
  Optional<SapoOrderTracking> findByType(String type);
}
