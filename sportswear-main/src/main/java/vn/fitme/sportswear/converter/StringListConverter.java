package vn.fitme.sportswear.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

  private static final String SEPARATOR = ";";

  @Override
  public String convertToDatabaseColumn(List<String> attribute) {
    return attribute != null ? String.join(SEPARATOR, attribute) : "";
  }

  @Override
  public List<String> convertToEntityAttribute(String dbData) {
    return dbData != null && !dbData.isEmpty()
        ? Arrays.asList(dbData.split(SEPARATOR))
        : new ArrayList<>();
  }
}
