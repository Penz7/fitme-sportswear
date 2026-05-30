package vn.fitme.sportswear.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

public class JsonUtils {
  private static final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule()) // hỗ trợ LocalDateTime
          .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS); // format ISO 8601


  public static String toJson(Object obj) {
    return toJson(obj, false);
  }

  public static String toJson(Object obj, Boolean isPretty) {
    try {
      if (isPretty) {
        objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
      }
      return objectMapper.writeValueAsString(obj);
    } catch (JsonProcessingException e) {
      return "{}";
    }
  }
}
