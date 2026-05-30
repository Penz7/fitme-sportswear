package vn.fitme.sportswear.util;

import vn.fitme.sportswear.service.pancake.address.dto.Province;
import vn.fitme.sportswear.service.sapo.address.dto.City;
import vn.fitme.sportswear.service.sapo.address.dto.District;
import vn.fitme.sportswear.service.sapo.address.dto.Ward;

import java.util.ArrayList;
import java.util.List;

public class HelperUtil {

  public static List<Object[]> findSimilarPairsWard(
      List<Ward> list1,
      List<vn.fitme.sportswear.service.pancake.address.dto.Ward> list2,
      int threshold) {
    List<Object[]> matchedPairs = new ArrayList<>();
    double maxSimilarity = 0;

    for (Ward p1 : list1) {
      for (vn.fitme.sportswear.service.pancake.address.dto.Ward p2 : list2) {
        double similarity = calculateSimilarity(p1.getName(), p2.getName());
        if (similarity >= threshold) {
          if (similarity > maxSimilarity) {
            matchedPairs.clear(); // Xóa danh sách nếu tìm thấy giá trị lớn hơn
            maxSimilarity = similarity;
          }
          if (similarity == maxSimilarity) {
            matchedPairs.add(new Object[] {p1, p2});
          }
        }
      }
    }

    return matchedPairs;
  }

  public static List<Object[]> findSimilarPairsDistrict(
      List<District> list1,
      List<vn.fitme.sportswear.service.pancake.address.dto.District> list2,
      int threshold) {
    List<Object[]> matchedPairs = new ArrayList<>();
    double maxSimilarity = 0;

    for (District p1 : list1) {
      for (vn.fitme.sportswear.service.pancake.address.dto.District p2 : list2) {
        double similarity = calculateSimilarity(p1.getName(), p2.getName());
        if (similarity >= threshold) {
          if (similarity > maxSimilarity) {
            matchedPairs.clear(); // Xóa danh sách nếu tìm thấy giá trị lớn hơn
            maxSimilarity = similarity;
          }
          if (similarity == maxSimilarity) {
            matchedPairs.add(new Object[] {p1, p2});
          }
        }
      }
    }

    return matchedPairs;
  }

  public static List<Object[]> findSimilarPairsCity(
      List<City> list1, List<Province> list2, int threshold) {
    List<Object[]> matchedPairs = new ArrayList<>();
    double maxSimilarity = 0;

    for (City p1 : list1) {
      for (Province p2 : list2) {
        double similarity = calculateSimilarity(p1.getName(), p2.getName());
        if (similarity >= threshold) {
          if (similarity > maxSimilarity) {
            matchedPairs.clear(); // Xóa danh sách nếu tìm thấy giá trị lớn hơn
            maxSimilarity = similarity;
          }
          if (similarity == maxSimilarity) {
            matchedPairs.add(new Object[] {p1, p2});
          }
        }
      }
    }

    return matchedPairs;
  }

  public static double calculateSimilarity(String s1, String s2) {
    int maxLength = Math.max(s1.length(), s2.length());
    if (maxLength == 0) return 100.0;

    int distance = levenshteinDistance(s1, s2);
    return ((1.0 - (double) distance / maxLength) * 100);
  }

  public static int levenshteinDistance(String s1, String s2) {
    int[][] dp = new int[s1.length() + 1][s2.length() + 1];

    for (int i = 0; i <= s1.length(); i++) {
      for (int j = 0; j <= s2.length(); j++) {
        if (i == 0) {
          dp[i][j] = j;
        } else if (j == 0) {
          dp[i][j] = i;
        } else {
          int cost = (s1.charAt(i - 1) == s2.charAt(j - 1)) ? 0 : 1;
          dp[i][j] =
              Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
        }
      }
    }
    return dp[s1.length()][s2.length()];
  }
}
