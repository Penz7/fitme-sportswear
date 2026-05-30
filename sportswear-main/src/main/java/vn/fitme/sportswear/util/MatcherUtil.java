package vn.fitme.sportswear.util;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.BiFunction;

@Component
@RequiredArgsConstructor
@Slf4j
public class MatcherUtil {


  public static <T1, T2> List<MatchResult<T1, T2>> match(
      List<T1> list1, List<T2> list2, BiFunction<T1, T2, Double> similarityFunc) {
    List<MatchResult<T1, T2>> allPairs = new ArrayList<>();

    for (T1 e1 : list1) {
      for (T2 e2 : list2) {
        double sim = similarityFunc.apply(e1, e2);
        allPairs.add(new MatchResult<>(e1, e2, sim));
      }
    }

    allPairs.sort(Comparator.comparingDouble((MatchResult<T1, T2> m) -> m.getSimilarity()).reversed());

    List<MatchResult<T1, T2>> finalMatches = new ArrayList<>();
    Set<T1> matchedT1 = new HashSet<>();
    Set<T2> matchedT2 = new HashSet<>();

    for (MatchResult<T1, T2> pair : allPairs) {
      if (!matchedT1.contains(pair.getFirst()) && !matchedT2.contains(pair.getSecond())) {
        finalMatches.add(pair);
        matchedT1.add(pair.getFirst());
        matchedT2.add(pair.getSecond());
      }
    }

    for (T1 e1 : list1) {
      if (!matchedT1.contains(e1)) {
        allPairs.stream()
            .filter(p -> p.getFirst().equals(e1))
            .max(Comparator.comparingDouble(MatchResult::getSimilarity))
            .ifPresent(
                best -> {
                  finalMatches.add(best);
                  matchedT1.add(e1);
                });
      }
    }

    for (T2 e2 : list2) {
      if (!matchedT2.contains(e2)) {
        allPairs.stream()
            .filter(p -> p.getSecond().equals(e2))
            .max(Comparator.comparingDouble(MatchResult::getSimilarity))
            .ifPresent(
                best -> {
                  finalMatches.add(best);
                  matchedT2.add(e2);
                });
      }
    }

    return finalMatches;
  }
}
