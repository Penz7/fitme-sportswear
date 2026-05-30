package vn.fitme.sportswear.controller.test;

import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.fitme.sportswear.service.pancake.PancakeService;
import vn.fitme.sportswear.service.pancake.product.dto.ProductData;
import vn.fitme.sportswear.service.pancake.product.dto.Variation;
import vn.fitme.sportswear.service.pancake.product.request.Product;
import vn.fitme.sportswear.service.pancake.product.response.ProductDataResponse;
import vn.fitme.sportswear.service.pancake.product.response.PagingResponse;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/pancake")
@RequiredArgsConstructor
public class TestPancakeProductController {

  private final PancakeService service;

  @GetMapping("/fetchProducts/{pageSize}/{pageNumber}/{search}")
  public ResponseEntity<PagingResponse<ProductData>> fetchProduct(
      @PathVariable Integer pageSize, @PathVariable Integer pageNumber, @PathVariable String search) {
    return ResponseEntity.ok(service.getProductPanCake().fetchProducts(pageSize, pageNumber, search));
  }

  @GetMapping("/createProduct")
  public ResponseEntity<ProductDataResponse> createProduct() {
    Product item = new Product();
    item.setName("San pham Moi");
    item.setCustomId("SP001-006");
    item.setCategoryIds(new ArrayList<>()); // phai truyền categoryId
    List<Variation> variations =
        List.of(
            new Variation(
                null,
                null,
                null,
                100000,
                200000,
                null,
                100,
                    null,
                "SP001-006-M",
                false),
            new Variation(
                null,
                null,
                null,
                110000,
                210000,
                null,
                100,
                null,
                "SP001-006-L",
                false),
            new Variation(
                null, null, null, 120000, 220000, null, 100, null, "SP001-006-XL", false));
    item.setVariations(variations);
//    item.setVariationsWarehouses(
//        List.of(
//            new VariationWarehouse(
//                100, PancakeStaticUtil.warehouseId, null, null, null, null, null, null)));
    ProductData productData = new ProductData();
    productData.setProduct(item);
    return ResponseEntity.ok(service.getProductPanCake().createProduct(productData));
  }


  @GetMapping("/updateProduct")
  public ResponseEntity<ProductDataResponse> updateProduct() {
    PagingResponse<ProductData> rs = service.getProductPanCake().fetchProducts(1, 1, null);
    ProductData productData = rs.getData().getFirst();
    Product item = productData.getProduct();
    item.setName("San pham Moi 333");
    item.setCategoryIds(new ArrayList<>()); // phai truyền categoryId
    productData.setProduct(item);
    return ResponseEntity.ok(service.getProductPanCake().updateProduct(productData.getProductId(), productData));
  }
}
