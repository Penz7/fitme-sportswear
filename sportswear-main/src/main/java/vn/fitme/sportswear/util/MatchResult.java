package vn.fitme.sportswear.util;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MatchResult<T1, T2> {
  private final T1 first;
  private final T2 second;
  private final double similarity;
}
