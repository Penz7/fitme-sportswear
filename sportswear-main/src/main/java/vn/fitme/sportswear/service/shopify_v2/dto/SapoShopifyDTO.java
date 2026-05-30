package vn.fitme.sportswear.service.shopify_v2.dto;

import java.time.LocalDateTime;

public record SapoShopifyDTO(
    Long id,
    String variantId,
    Integer available,
    Long oldAvailable,
    LocalDateTime updatedAt,
    LocalDateTime oldUpdatedAt) {}
