package vn.fitme.sportswear.service.pancake.product.dto;

import java.time.LocalDateTime;

public record SapoPancakeDTO(
    Long id,
    String variantId,
    String warehouseId,
    Integer available,
    Integer oldAvailable,
    LocalDateTime updatedAt,
    LocalDateTime oldUpdatedAt) {}
