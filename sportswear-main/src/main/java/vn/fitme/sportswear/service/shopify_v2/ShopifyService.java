package vn.fitme.sportswear.service.shopify_v2;

import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vn.fitme.sportswear.mapper.ProductShopifyMapper;
import vn.fitme.sportswear.repository.ShopifyProductRepository;
import vn.fitme.sportswear.repository.entity.SapoProduct;
import vn.fitme.sportswear.service.shopify.ShopifySdk;
import vn.fitme.sportswear.service.shopify.model.*;
import vn.fitme.sportswear.service.shopify_v2.dto.Product;
import vn.fitme.sportswear.service.shopify_v2.dto.ProductsResponse;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Data
@RequiredArgsConstructor
@Slf4j
public class ShopifyService {
  @Value("${app.config.shopify.access-token}")
  private String accessToken;

  @Value("${app.config.shopify.subdomain}")
  private String subdomain;

  private static String locationId = null;
  private final RestTemplate restTemplate;

  private ShopifySdk shopifySdk;

  @PostConstruct
  public void init() {
    this.shopifySdk =
        ShopifySdk.newBuilder().withSubdomain(subdomain).withAccessToken(accessToken).build();
  }

  private final ShopifyProductRepository shopifyProductRepository;
  private final ShopifyProductBatchSaver shopifyProductBatchSaver;
  private final int DEFAULT_LIMIT = 50;
  private final String DEFAULT_FIELDS = "id,title,vendor,product_type,status,images,variants";
  private final String API_VERSION = "2024-04";
  private static final Pattern NEXT_LINK_PATTERN = Pattern.compile("<([^>]+)>;\\s*rel=\"next\"");

  private final ProductShopifyMapper productMapper;

  @Transactional
  public void saveProductsInDatabaseV1() {
    long startTime = System.currentTimeMillis();
    ShopifyPage<ShopifyProduct> shopifyProductsPage = shopifySdk.getProducts(DEFAULT_LIMIT);
    Set<String> seenSkus = new HashSet<>();

    while (shopifyProductsPage != null) {
      List<ShopifyProduct> products = shopifyProductsPage.stream().toList();

      List<vn.fitme.sportswear.repository.entity.ShopifyProduct> entities =
          products.stream()
              .flatMap(
                  product ->
                      productMapper
                          .toHistoricalProductV1(shopifyProductRepository, product, seenSkus)
                          .stream())
              .toList();
      try {
        shopifyProductRepository.saveAllAndFlush(entities);
        Thread.sleep(10);
      } catch (InterruptedException ie) {
        Thread.currentThread().interrupt();
      } catch (Exception e) {
        log.error("[saveProductsInDatabase] Error syncing products: ", e);
      }
      String nextPageInfo = shopifyProductsPage.getNextPageInfo();
      shopifyProductsPage =
          (nextPageInfo != null) ? shopifySdk.getProducts(nextPageInfo, DEFAULT_LIMIT) : null;
    }
    log.info("Sync Shopify data success in: {} ms", System.currentTimeMillis() - startTime);
  }

  public void saveProductsInDatabase() {
    long startTime = System.currentTimeMillis();
    Set<String> seenSkus = new HashSet<>();

    String currentUrl =
        buildInitialUrl(DEFAULT_FIELDS, Math.min(DEFAULT_LIMIT, 250)); // Giới hạn max 250

    HttpHeaders headers = new HttpHeaders();
    headers.set("X-Shopify-Access-Token", accessToken);
    headers.setContentType(MediaType.APPLICATION_JSON);
    HttpEntity<String> entity = new HttpEntity<>(headers);

    String nextPageInfo;
    int pageCount = 0;
    List<Product> productsOnPage;
    do {
      pageCount++;
      try {
        ResponseEntity<ProductsResponse> response =
            restTemplate.exchange(currentUrl, HttpMethod.GET, entity, ProductsResponse.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
          productsOnPage = response.getBody().getProducts();
          if (productsOnPage != null && !productsOnPage.isEmpty()) {
            List<vn.fitme.sportswear.repository.entity.ShopifyProduct> entities =
                productsOnPage.stream()
                    .flatMap(
                        product ->
                            productMapper
                                .toHistoricalProduct(shopifyProductRepository, product, seenSkus)
                                .stream())
                    .toList();
            try {
              shopifyProductBatchSaver.saveBatch(entities);
              Thread.sleep(10);
            } catch (InterruptedException ie) {
              Thread.currentThread().interrupt();
            } catch (Exception e) {
              log.error("[saveProductsInDatabase] Error syncing products: ", e);
            }
          }

          // Parse Link header để lấy page_info cho trang tiếp theo
          nextPageInfo = parseNextPageInfoFromLinkHeader(response.getHeaders());
          if (nextPageInfo != null) {
            currentUrl =
                buildNextPageUrl(DEFAULT_FIELDS, Math.min(DEFAULT_LIMIT, 250), nextPageInfo);
          }
        } else {
          nextPageInfo = null; // Dừng nếu có lỗi
        }

      } catch (HttpClientErrorException e) {
        log.error(
            "[saveProductsInDatabase] Shopify API Error on page {}: {} - {}. URL: {}. Stopping.",
            pageCount,
            e.getStatusCode(),
            e.getResponseBodyAsString(),
            currentUrl,
            e);
        nextPageInfo = null; // Dừng nếu có lỗi API
      } catch (Exception e) {
        log.error(
            "[saveProductsInDatabase] An unexpected error occurred on page {} while fetching Shopify products. URL: "
                + "{}. Stopping.",
            pageCount,
            currentUrl,
            e);
        nextPageInfo = null; // Dừng nếu có lỗi không mong muốn
      }

      // Thêm một khoảng nghỉ nhỏ để tránh rate limiting, đặc biệt nếu bạn có rất nhiều sản phẩm.
      // Điều này rất quan trọng cho các shop lớn.
      if (nextPageInfo != null) {
        try {
          Thread.sleep(500); // Nghỉ 500ms
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          log.warn(
              "[saveProductsInDatabase] Thread interrupted during sleep, stopping pagination.");
          nextPageInfo = null;
        }
      }

    } while (nextPageInfo != null);
    log.info(
        "[saveProductsInDatabase] Save shopify to database success in: {} ms",
        System.currentTimeMillis() - startTime);
  }

  public void updateVariant(String variantId, Long available) {
    ShopifyVariant shopifyVariant = shopifySdk.getVariant(variantId);
    if (shopifyVariant == null) return;
    if (!"shopify".equals(shopifyVariant.getInventoryManagement())) {
      shopifyVariant.setAvailable(available);
      shopifyVariant.setInventoryQuantity(available);
      ShopifyVariantUpdateRequest shopifyVariantUpdateRequest =
          ShopifyVariantUpdateRequest.newBuilder()
              .withCurrentShopifyVariant(shopifyVariant)
              .withSamePrice()
              .withSameCompareAtPrice()
              .withSameSku()
              .withSameBarcode()
              .withSameWeight()
              .withAvailable(available)
              .withSameFirstOption()
              .withSameSecondOption()
              .withSameThirdOption()
              .withSameImage()
              .withSameInventoryManagement()
              .withSameInventoryPolicy()
              .withSameFulfillmentService()
              .withSameRequiresShipping()
              .withSameTaxable()
              .withSameInventoryItemId()
              .build();
      shopifySdk.updateVariant(shopifyVariantUpdateRequest);
    }
    if (locationId == null) {
      List<ShopifyLocation> shopifyLocations = shopifySdk.getLocations();
      locationId = shopifyLocations.getFirst().getId();
    }
    shopifySdk.updateInventoryLevel(shopifyVariant.getInventoryItemId(), locationId, available);
  }

  public ShopifyProduct createProduct(SapoProduct sapoProduct) {
    List<String> sortedOptionNames = Collections.emptyList();
    List<String> imageSources = Collections.emptyList();
    List<ShopifyVariantCreationRequest> variantCreationRequests =
        Collections.singletonList(
            ShopifyVariantCreationRequest.newBuilder()
                .withPrice(BigDecimal.valueOf(sapoProduct.getRetailPrice()))
                .noCompareAtPrice()
                .withSku(sapoProduct.getSku())
                .withBarcode(sapoProduct.getSku())
                .withWeight(BigDecimal.ZERO)
                .withAvailable(sapoProduct.getAvailable())
                .noFirstOption()
                .noSecondOption()
                .noThirdOption()
                .noImageSource()
                .withInventoryManagement("shopify")
                .withInventoryPolicy(InventoryPolicy.DENY)
                .withDefaultFulfillmentService()
                .withRequiresShippingDefault()
                .withTaxableDefault()
                .build());
    ShopifyProductCreationRequest shopifyProductCreationRequest =
        ShopifyProductCreationRequest.newBuilder()
            .withTitle(sapoProduct.getName())
            .withMetafieldsGlobalTitleTag(null)
            .withProductType(null)
            .withBodyHtml(null)
            .withMetafieldsGlobalDescriptionTag(null)
            .withVendor(null)
            .withTags(null)
            .withSortedOptionNames(sortedOptionNames)
            .withImageSources(imageSources)
            .withVariantCreationRequests(variantCreationRequests)
            .withPublished(false)
            .build();
    return shopifySdk.createProduct(shopifyProductCreationRequest);
  }

  public boolean deleteProduct(String productId) {
    String url =
        String.format(
            "https://%s.myshopify.com/admin/api/%s/products/%s.json",
            subdomain, API_VERSION, productId);

    HttpHeaders headers = new HttpHeaders();
    headers.set("X-Shopify-Access-Token", accessToken);
    headers.setAccept(
        Collections.singletonList(MediaType.APPLICATION_JSON)); // Shopify thường trả về JSON

    HttpEntity<String> entity = new HttpEntity<>(headers); // Không cần body cho DELETE

    try {
      ResponseEntity<String> response =
          restTemplate.exchange(
              url, HttpMethod.DELETE, entity, String.class // Shopify trả về {} rỗng khi thành công
              );

      return response.getStatusCode() == HttpStatus.OK;
    } catch (HttpClientErrorException e) {
      log.error("[deleteProduct] Lỗi khi xóa sản phẩm ID {}: {}", productId, e.getMessage());
      return false;
    } catch (Exception e) {
      log.error(
          "[deleteProduct] Lỗi không xác định khi  xóa sản phẩm ID {}: {}",
          productId,
          e.getMessage());
      return false;
    }
  }

  public List<Product> getProductsPage(int limit, String fields, String pageInfo) {
    UriComponentsBuilder builder =
        UriComponentsBuilder.fromHttpUrl(
            String.format(
                "https://%s.myshopify.com/admin/api/%s/products.json", subdomain, API_VERSION));

    if (limit > 0 && limit <= 250) { // Shopify giới hạn tối đa 250
      builder.queryParam("limit", limit);
    } else if (limit > 250) {
      builder.queryParam("limit", 250); // Giới hạn tối đa là 250
      log.warn("Requested limit {} exceeds Shopify's max limit of 250. Using 250.", limit);
    }

    if (fields != null && !fields.isEmpty()) {
      builder.queryParam("fields", fields);
    }
    if (pageInfo != null && !pageInfo.isEmpty()) {
      builder.queryParam("page_info", pageInfo);
    }

    String url = builder.toUriString();

    HttpHeaders headers = new HttpHeaders();
    headers.set("X-Shopify-Access-Token", accessToken);
    headers.setContentType(MediaType.APPLICATION_JSON);
    HttpEntity<String> entity = new HttpEntity<>(headers);

    try {
      log.info("Requesting products from Shopify URL: {}", url);
      ResponseEntity<ProductsResponse> response =
          restTemplate.exchange(url, HttpMethod.GET, entity, ProductsResponse.class);

      if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
        log.info(
            "Successfully fetched {} products for this page.",
            response.getBody().getProducts().size());
        // Quan trọng: trả về response đầy đủ để có thể lấy Link header
        // Chúng ta sẽ tạo một wrapper class hoặc xử lý trực tiếp
        // Ở đây, để đơn giản, chúng ta sẽ giả định phương thức này chỉ trả về product list cho
        // trang hiện tại
        // và việc xử lý Link header sẽ ở phương thức gọi
        return response.getBody().getProducts();
      } else {
        log.warn(
            "Received non-OK status or null body from Shopify: {} for URL: {}",
            response.getStatusCode(),
            url);
        return Collections.emptyList();
      }
    } catch (HttpClientErrorException e) {
      log.error(
          "Shopify API Error: {} - {} for URL: {}",
          e.getStatusCode(),
          e.getResponseBodyAsString(),
          url,
          e);
      return Collections.emptyList();
    } catch (Exception e) {
      log.error(
          "An unexpected error occurred while fetching Shopify products from URL: {}", url, e);
      return Collections.emptyList();
    }
  }

  private String buildInitialUrl(String fields, int limit) {
    UriComponentsBuilder builder =
        UriComponentsBuilder.fromHttpUrl(
            String.format(
                "https://%s.myshopify.com/admin/api/%s/products.json", subdomain, API_VERSION));
    if (limit > 0) {
      builder.queryParam("limit", limit);
    }
    if (fields != null && !fields.isEmpty()) {
      builder.queryParam("fields", fields);
    }
    return builder.toUriString();
  }

  private String buildNextPageUrl(String fields, int limit, String pageInfo) {
    UriComponentsBuilder builder =
        UriComponentsBuilder.fromHttpUrl(
            String.format(
                "https://%s.myshopify.com/admin/api/%s/products.json", subdomain, API_VERSION));
    if (limit > 0) {
      builder.queryParam("limit", limit);
    }
    if (fields != null && !fields.isEmpty()) {
      builder.queryParam("fields", fields);
    }
    if (pageInfo != null && !pageInfo.isEmpty()) {
      builder.queryParam("page_info", pageInfo); // page_info được trích xuất từ Link header
    }
    return builder.toUriString();
  }

  /**
   * Parses the Link header from Shopify's response to find the "next" page URL, and extracts the
   * page_info parameter from it.
   *
   * @param headers HttpHeaders from the Shopify response.
   * @return The page_info string for the next page, or null if not found.
   */
  private String parseNextPageInfoFromLinkHeader(HttpHeaders headers) {
    List<String> linkHeaders = headers.get("Link");
    if (linkHeaders == null || linkHeaders.isEmpty()) {
      return null;
    }

    // Shopify thường chỉ trả về một giá trị cho 'Link' header, nhưng API cho phép nhiều.
    // Ta sẽ duyệt qua tất cả các link string (thường chỉ có 1)
    for (String linkHeaderValue : linkHeaders) {
      // Một Link header có thể chứa nhiều link, phân tách bằng dấu phẩy
      // ví dụ: <url1>; rel="next", <url2>; rel="previous"
      String[] links = linkHeaderValue.split(",\\s*");
      for (String link : links) {
        Matcher matcher = NEXT_LINK_PATTERN.matcher(link.trim());
        if (matcher.matches()) {
          String nextUrl = matcher.group(1); // URL đầy đủ của trang tiếp theo
          // Trích xuất page_info từ URL này
          UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromHttpUrl(nextUrl);
          return uriBuilder.build().getQueryParams().getFirst("page_info");
        }
      }
    }
    return null; // Không tìm thấy link "next"
  }
}
