package vn.fitme.sportswear.service;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.fitme.sportswear.repository.PancakeProductRepository;
import vn.fitme.sportswear.repository.SapoProductRepository;
import vn.fitme.sportswear.repository.ShopifyProductRepository;
import vn.fitme.sportswear.repository.entity.*;
import vn.fitme.sportswear.service.pancake.PancakeService;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.pancake.product.dto.SapoPancakeDTO;
import vn.fitme.sportswear.service.pancake.product.dto.VariationWarehouse;
import vn.fitme.sportswear.service.pancake.product.request.Product;
import vn.fitme.sportswear.service.pancake.product.request.WarehouseRequest;
import vn.fitme.sportswear.service.pancake.product.response.ProductDataResponse;
import vn.fitme.sportswear.service.sapo.SapoService;
import vn.fitme.sportswear.service.shopify.model.ShopifyProduct;
import vn.fitme.sportswear.service.shopify_v2.ShopifyService;
import vn.fitme.sportswear.service.shopify_v2.dto.SapoShopifyDTO;
import vn.fitme.sportswear.util.*;

import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static vn.fitme.sportswear.util.ProductHelperUtil.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Getter
public class BusinessProductService {
  @Value("${app.config.enable-create-order-in-pancake:false}")
  private boolean enableCreateOrderInPancake;

  @Value("${app.config.enable-sync-address:false}")
  private boolean enableSyncAddress;

  @Value("${app.config.enable-create-product-in-shopify:false}")
  private boolean enableCreateProductInShopify;

  private final PancakeService pancakeService;
  private final ShopifyService shopifyService;
  private final SapoService sapoService;
  private final SapoProductRepository sapoProductRepository;
  private final PancakeProductRepository pancakeProductRepository;
  private final ShopifyProductRepository shopifyProductRepository;

  private final ExecutorService executor = Executors.newFixedThreadPool(2);

  public void syncProducts() {
    long now = System.currentTimeMillis();
    log.info("[syncProducts] Start fetch products sapo!");
    sapoService.saveProductsInDatabase();
    log.info("[syncProducts] Success fetch products sapo in: {} ms", System.currentTimeMillis() - now);
    CompletableFuture<Void> syncA =
        CompletableFuture.runAsync(
            () -> {
              long now1 = System.currentTimeMillis();
              log.info("[syncProducts] Start sync products pancake!");
              pancakeService.saveProductsInDatabase();
              pancakeProductRepository
                  .findSapoPancakeProducts()
                  .forEach(this::updatePancakeInventoryWhenMatch);
              sapoProductRepository
                  .findSapoProductsNotInPancake()
                  .forEach(this::updatePancakeInventoryWhenNotMatch);
              log.info(
                  "[syncProducts] Success sync products pancake in: {} ms",
                  System.currentTimeMillis() - now1);
            },
            executor);

    CompletableFuture<Void> syncB =
        CompletableFuture.runAsync(
            () -> {
              long now2 = System.currentTimeMillis();
              log.info("[syncProducts] Start sync products shopify!");
              shopifyService.saveProductsInDatabase();
              shopifyProductRepository
                  .findSapoShopifyProducts()
                  .forEach(this::updateShopifyInventoryWhenMatch);
              if (enableCreateProductInShopify) {
                sapoProductRepository
                    .findSapoProductsNotInShopify()
                    .forEach(this::updateShopifyInventoryWhenNotMatch);
              }
              log.info(
                  "[syncProducts] Success sync products shopify in: {} ms",
                  System.currentTimeMillis() - now2);
            },
            executor);
    CompletableFuture.allOf(syncA, syncB).join();
  }

  public void updatePancakeInventoryWhenMatch(SapoPancakeDTO sapoPancakeDTO) {
    try {
      if (sapoPancakeDTO.updatedAt() == null || sapoPancakeDTO.available() == null) return;
      if (sapoPancakeDTO.oldUpdatedAt() != null
          && Math.abs(
                  ChronoUnit.MINUTES.between(
                      sapoPancakeDTO.updatedAt(), sapoPancakeDTO.oldUpdatedAt()))
              < 10
          && sapoPancakeDTO.available().equals(sapoPancakeDTO.oldAvailable())) return;

      WarehouseRequest request = new WarehouseRequest();
      VariationWarehouse warehouse = new VariationWarehouse();
      warehouse.setWarehouseId(
          sapoPancakeDTO.warehouseId() == null
              ? PancakeStaticUtil.warehouseId
              : sapoPancakeDTO.warehouseId());
      warehouse.setRemainQuantity(sapoPancakeDTO.available());
      request.setVariationsWarehouses(List.of(warehouse));
      Object ok =
          pancakeService.getProductPanCake().updateQuantity(sapoPancakeDTO.variantId(), request);
      if (ok instanceof Map<?, ?> map) {
        Object successValue = map.get("success");
        if (Boolean.TRUE.equals(successValue)) {
          pancakeProductRepository.updateAvailableById(
              sapoPancakeDTO.id(), sapoPancakeDTO.available());
        } else {
          log.error(
              "[updatePancakeInventoryWhenMatch] Update failed with id: {},  request: [{}] and response: {}",
              sapoPancakeDTO.variantId(),
              JsonUtils.toJson(request),
              ok);
        }
      }
      Thread.sleep(10);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      log.error("[updatePancakeInventoryWhenMatch] Error updating inventory: ", e);
    }
  }

  public void updatePancakeInventoryWhenNotMatch(SapoProduct sapoProduct) {

    // create product in pancake
    Product item = getProduct(sapoProduct);
    ProductData productData = new ProductData();
    productData.setProduct(item);
    String variationId = null;
    String productId = null;
    String warehouseId = null;
    try {
      ProductDataResponse productDataResponse =
          pancakeService.getProductPanCake().createProduct(productData);
      // update quantity
      ProductDataResponse.Variation variation =
          productDataResponse.getData().getVariations().getFirst();
      variationId = variation.getId().toString();
      productId = variation.getProductId().toString();
      Thread.sleep(10);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      ProductData inPancake = pancakeService.checkInPancake(sapoProduct.getSku());
      if (inPancake != null) {
        productId = inPancake.getProductId();
        variationId = inPancake.getId();
        warehouseId = inPancake.getVariationsWarehouses().getFirst().getWarehouseId();
      } else {
        log.error("[updatePancakeInventoryWhenNotMatch] Error creating product in Pancake: ", e);
        return;
      }
    }
    try {
      if (variationId == null || productId == null) {
        return;
      }
      String wId = warehouseId == null ? PancakeStaticUtil.warehouseId : warehouseId;
      WarehouseRequest request = new WarehouseRequest();
      VariationWarehouse warehouse = new VariationWarehouse();
      warehouse.setWarehouseId(wId);
      warehouse.setRemainQuantity(sapoProduct.getAvailable());
      request.setVariationsWarehouses(List.of(warehouse));
      pancakeService.getProductPanCake().updateQuantity(variationId, request);
      // save to database
      PancakeProduct pancakeProduct = getPancakeProduct(sapoProduct, productId, variationId, wId);
      pancakeProductRepository.save(pancakeProduct);
    } catch (Exception e) {
      log.error("[updatePancakeInventoryWhenNotMatch] Error creating product in Pancake: ", e);
    }
  }

  public void updateShopifyInventoryWhenMatch(SapoShopifyDTO sapoShopifyDTO) {
    try {
      if (sapoShopifyDTO.updatedAt() == null || sapoShopifyDTO.available() == null) return;
      if (sapoShopifyDTO.oldUpdatedAt() != null
          && Math.abs(
                  ChronoUnit.MINUTES.between(
                      sapoShopifyDTO.updatedAt(), sapoShopifyDTO.oldUpdatedAt()))
              < 10
          && Long.valueOf(sapoShopifyDTO.available()).equals(sapoShopifyDTO.oldAvailable())) return;

      Long newAvailable = Long.valueOf(sapoShopifyDTO.available());
      shopifyService.updateVariant(sapoShopifyDTO.variantId(), newAvailable);
      shopifyProductRepository.updateAvailableById(sapoShopifyDTO.id(), newAvailable);
      Thread.sleep(10);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      log.error("[updateShopifyInventoryWhenMatch] Error updating inventory: ", e);
    }
  }

  public void updateShopifyInventoryWhenNotMatch(SapoProduct sapoProduct) {
    String variationId;
    String productId;
    try {
      ShopifyProduct product = shopifyService.createProduct(sapoProduct);
      productId = product.getId();
      variationId = product.getVariants().getFirst().getId();
      shopifyService.updateVariant(variationId, Long.valueOf(sapoProduct.getAvailable()));
    } catch (Exception e) {
      log.error("[updateShopifyInventoryWhenNotMatch] Error creating product in Shopify: ", e);
      return;
    }
    if (variationId == null || productId == null) {
      return;
    }
    vn.fitme.sportswear.repository.entity.ShopifyProduct shopifyProduct =
        getShopifyProduct(sapoProduct, productId, variationId);
    shopifyProductRepository.save(shopifyProduct);
  }

  public void deleteShopifyProducts() {
    List<String> ids = new ArrayList<>();
    shopifyProductRepository
        .findAll()
        .forEach(
            element -> {
              log.info("[deleteShopifyProducts] Checking product: {}", element.getProductId());
              ShopifyProduct ok = null;
              try {
                ok = shopifyService.getShopifySdk().getProduct(element.getProductId());
              } catch (Exception ignored) {
                log.error(
                    "[deleteShopifyProducts] Error getting product: {}", element.getProductId());
              }
              if (ok != null) {
                if ((Objects.isNull(ok.getImages()) || ok.getImages().isEmpty())
                    && (Objects.isNull(ok.getTags()) || ok.getTags().isEmpty())) {
                  try {
                    shopifyService.deleteProduct(element.getProductId());
                    shopifyProductRepository.deleteById(element.getId());
                    shopifyProductRepository.flush();
                  } catch (Exception e) {
                    log.error(
                        "[deleteShopifyProducts] Error deleting product: {}",
                        element.getProductId(),
                        e);
                  }
                  log.info("[deleteShopifyProducts] Deleted product: {}", element.getProductId());
                }
              } else {
                ids.add(element.getProductId());
                log.info("[deleteShopifyProducts] Not found product: {}", element.getProductId());
              }
              if (!ids.isEmpty() && ids.size() > 10) {
                shopifyProductRepository.deleteAllByProductIdIn(ids);
                ids.clear();
              }
            });
    if (!ids.isEmpty()) {
      shopifyProductRepository.deleteAllByProductIdIn(ids);
    }
  }
}
