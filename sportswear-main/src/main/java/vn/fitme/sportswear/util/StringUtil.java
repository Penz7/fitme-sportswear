package vn.fitme.sportswear.util;

import java.util.Map;

public class StringUtil {

  public static boolean isNullOrEmpty(String str) {
    return str == null || str.trim().isEmpty();
  }

  public static String NVL(String... values) {
    for (String val : values) {
      if (!isNullOrEmpty(val)) {
        return val;
      }
    }
    return null;
  }
  public static String NVL2(String value, String defaultValue) {
    if (!isNullOrEmpty(value)) {
      return value + ",";
    }
    return defaultValue;
  }

  private static final Map<String, String> COUNTRY_PREFIX_TO_LOCAL_PREFIX = Map.ofEntries(
          Map.entry("+84", "0"),   // Việt Nam
          Map.entry("+1", ""),     // Mỹ, Canada
          Map.entry("+44", "0"),   // UK
          Map.entry("+91", "0"),   // Ấn Độ
          Map.entry("+81", "0"),   // Nhật
          Map.entry("+82", "0"),   // Hàn Quốc
          Map.entry("+65", ""),    // Singapore (không dùng số 0 đầu)
          Map.entry("+66", "0"),   // Thái Lan
          Map.entry("+62", "0"),   // Indonesia
          Map.entry("+86", "0"),   // Trung Quốc
          Map.entry("+33", "0"),   // Pháp
          Map.entry("+49", "0"),   // Đức
          Map.entry("+34", "0")    // Tây Ban Nha
          // → có thể thêm tùy nhu cầu
  );

  public static String normalizePhone(String phone) {
    if (phone == null || phone.isEmpty()) return phone;

    // Xoá mọi ký tự không phải + hoặc số
    phone = phone.trim().replaceAll("[^+0-9]", "");

    // Kiểm tra xem số có thuộc mã quốc gia nào không
    for (Map.Entry<String, String> entry : COUNTRY_PREFIX_TO_LOCAL_PREFIX.entrySet()) {
      String internationalPrefix = entry.getKey();
      String localPrefix = entry.getValue();

      if (phone.startsWith(internationalPrefix)) {
        String rest = phone.substring(internationalPrefix.length());

        // Nếu localPrefix là "0" và rest đã bắt đầu bằng "0" thì không thêm lại
        if ("0".equals(localPrefix) && rest.startsWith("0")) {
          return rest;
        }
        return localPrefix + rest;
      }
    }

    return phone; // Nếu không khớp mã nào, trả về nguyên bản
  }

}
