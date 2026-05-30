package vn.fitme.sportswear.service.sapo.product.request;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;
import vn.fitme.sportswear.service.sapo.product.dto.Metadata;
import vn.fitme.sportswear.service.sapo.product.dto.PurchaseOrder;
import java.util.List;

@Data


@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PurchaseOrderResponse {
  private Metadata metadata;
  private List<PurchaseOrder> purchaseOrders;
}
