package vn.fitme.sportswear.constant;

import lombok.experimental.UtilityClass;

@UtilityClass
public class SapoConstant {
  public static final String PAGE = "page";
  public static final String LIMIT = "limit";
  public static final String QUERY = "query";
  public static final String STATUS = "status";
  public static final String RETURN_STATUS = "return_status";

  public static final String PRODUCT_SEARCH_URL = "/admin/products/search.json";
  public static final String PRODUCT_URL = "/admin/products.json";

  // Danh sách đơn hàng
  public static final String ORDER_URL = "/admin/orders.json";

  // Danh sách nhập hàng
  public static final String PURCHASE_ORDER_URL = "/admin/purchase_orders.json";

  public static final String CUSTOMER_SEARCH_URL = "/admin/customers/doSearch.json";
  public static final String CUSTOMER_URL = "/admin/customers.json";
}
