package vn.fitme.sportswear.util;

import jakarta.annotation.PostConstruct;
import org.springframework.cache.annotation.Cacheable;
import vn.fitme.sportswear.config.DatabaseProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.sql.*;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class DynamicTableManagerUtil {
  private final DatabaseProperties databaseProperties;

  private static Connection conn;

  @PostConstruct
  public void initConnection() throws SQLException {
    conn =
        DriverManager.getConnection(
            databaseProperties.getUrl(),
            databaseProperties.getUsername(),
            databaseProperties.getPassword());
  }

  public void dropTableIfExists(String tableName) throws SQLException {
    String sql = "DROP TABLE IF EXISTS " + tableName;
    try (Statement stmt = conn.createStatement()) {
      stmt.executeUpdate(sql);
      log.info("Dropped table: {}", tableName);
    }
  }

  public void deleteAllFromTable(String tableName) throws SQLException {
    String sql = "DELETE FROM " + tableName;
    try (Statement stmt = conn.createStatement()) {
      int count = stmt.executeUpdate(sql);
      log.info("Deleted {} rows from table: {}", count, tableName);
    }
  }

  /**
   * Performs a dynamic query against a table. The query is constructed using the provided table
   * name, filters, order by clause, and limit. The results are cached for 1 hour.
   *
   * @param tableName the name of the table to query
   * @param filters a map of column names to filter values. e.g. "name = ?" would be represented as
   *     a map with a single entry "name" -> "John Doe".
   * @param orderBy the column to order the results by
   * @param limit the maximum number of results to return
   * @return a list of maps, where each map represents a row in the table
   * @throws SQLException if an error occurs while executing the query
   */
  @Cacheable(
      cacheNames = "dynamicQueries",
      key = "T(java.util.Objects).hash(#tableName, #filters, #orderBy, #limit)")
  public static List<Map<String, Object>> findAllDynamic(
      String tableName, Map<String, Object> filters, String orderBy, Integer limit)
      throws SQLException {

    if (!tableName.matches("^[a-zA-Z0-9_]+$")) {
      throw new IllegalArgumentException("Invalid table name");
    }

    List<Map<String, Object>> results = new ArrayList<>();
    StringBuilder sql = new StringBuilder("SELECT * FROM ").append(tableName);
    List<Object> parameters = new ArrayList<>();

    // WHERE clause
    if (filters != null && !filters.isEmpty()) {
      sql.append(" WHERE ");
      int count = 0;
      for (String key : filters.keySet()) {
        if (count++ > 0) sql.append(" AND ");
        sql.append(key).append(" = ?");
        parameters.add(filters.get(key));
      }
    }

    // ORDER BY
    if (orderBy != null && !orderBy.isBlank()) {
      sql.append(" ORDER BY ").append(orderBy);
    }

    // LIMIT
    if (limit != null && limit > 0) {
      sql.append(" LIMIT ").append(limit);
    }

    try (PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
      for (int i = 0; i < parameters.size(); i++) {
        stmt.setObject(i + 1, parameters.get(i));
      }

      try (ResultSet rs = stmt.executeQuery()) {
        ResultSetMetaData meta = rs.getMetaData();
        int columnCount = meta.getColumnCount();

        while (rs.next()) {
          Map<String, Object> row = new LinkedHashMap<>();
          for (int i = 1; i <= columnCount; i++) {
            row.put(meta.getColumnName(i), rs.getObject(i));
          }
          results.add(row);
        }
      }
    }

    log.info("Query [{}] returned {} rows", sql, results.size());
    return results;
  }

  public List<Map<String, Object>> findAll(String tableName) throws SQLException {
    List<Map<String, Object>> results = new ArrayList<>();
    String sql = "SELECT * FROM " + tableName;

    try (Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(sql)) {
      ResultSetMetaData metaData = rs.getMetaData();
      int columnCount = metaData.getColumnCount();

      while (rs.next()) {
        Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 1; i <= columnCount; i++) {
          String columnName = metaData.getColumnName(i);
          Object value = rs.getObject(i);
          row.put(columnName, value);
        }
        results.add(row);
      }
    }

    log.info("Found {} rows in table {}", results.size(), tableName);
    return results;
  }

  public <T> void saveAll(String tableName, List<Class<T>> results) throws Exception {
    for (Class<T> result : results) {
      save(tableName, result);
    }
  }

  public <T> void save(String tableName, Class<T> result) throws Exception {
    List<String> columns = new ArrayList<>();
    List<Object> values = new ArrayList<>();

    extractValues(result, columns, values);

    String placeholders = String.join(", ", Collections.nCopies(columns.size(), "?"));

    String sql =
        "INSERT INTO "
            + tableName
            + " ("
            + String.join(", ", columns)
            + ") VALUES ("
            + placeholders
            + ")";

    try (PreparedStatement ps = conn.prepareStatement(sql)) {
      for (int i = 0; i < values.size(); i++) {
        ps.setObject(i + 1, values.get(i));
      }
      ps.executeUpdate();
    }
  }

  public <T1, T2> void createTableIfNotExists(
      String tableName, Class<T1> t1Class, Class<T2> t2Class) throws SQLException {
    Map<String, String> columns = extractFields(t1Class, "sapo");
    columns.putAll(extractFields(t2Class, "pancake"));
    columns.put("similarity", "DOUBLE PRECISION");

    StringBuilder sql =
        new StringBuilder("CREATE TABLE IF NOT EXISTS ")
            .append(tableName)
            .append(" (id SERIAL PRIMARY KEY, ");

    for (Map.Entry<String, String> entry : columns.entrySet()) {
      sql.append(entry.getKey()).append(" ").append(entry.getValue()).append(", ");
    }
    sql.setLength(sql.length() - 2);
    sql.append(")");

    try (Statement stmt = conn.createStatement()) {
      stmt.execute(sql.toString());
    }
  }

  public <T> void createTableIfNotExists(String tableName, Class<T> tClass) throws SQLException {
    Map<String, String> columns = extractFields(tClass);

    StringBuilder sql =
        new StringBuilder("CREATE TABLE IF NOT EXISTS ")
            .append(tableName)
            .append(" (id SERIAL PRIMARY KEY, ");

    for (Map.Entry<String, String> entry : columns.entrySet()) {
      sql.append(entry.getKey()).append(" ").append(entry.getValue()).append(", ");
    }
    sql.setLength(sql.length() - 2);
    sql.append(")");

    try (Statement stmt = conn.createStatement()) {
      stmt.execute(sql.toString());
    }
  }

  public <T1, T2> void save(String tableName, MatchResult<T1, T2> result) throws Exception {
    List<String> columns = new ArrayList<>();
    List<Object> values = new ArrayList<>();

    extractValues(result.getFirst(), "sapo", columns, values);
    extractValues(result.getSecond(), "pancake", columns, values);
    columns.add("similarity");
    values.add(result.getSimilarity());

    String placeholders = String.join(", ", Collections.nCopies(columns.size(), "?"));

    String sql =
        "INSERT INTO "
            + tableName
            + " ("
            + String.join(", ", columns)
            + ") VALUES ("
            + placeholders
            + ")";

    try (PreparedStatement ps = conn.prepareStatement(sql)) {
      for (int i = 0; i < values.size(); i++) {
        ps.setObject(i + 1, values.get(i));
      }
      ps.executeUpdate();
    }
  }

  private Map<String, String> extractFields(Class<?> clazz) {
    return extractFields(clazz, "");
  }

  private Map<String, String> extractFields(Class<?> clazz, String prefix) {
    Map<String, String> map = new LinkedHashMap<>();
    for (Field f : clazz.getDeclaredFields()) {
      f.setAccessible(true);
      map.put(prefix + "_" + f.getName(), toSqlType(f.getType()));
    }
    return map;
  }

  private void extractValues(Object obj, List<String> cols, List<Object> vals) throws Exception {
    extractValues(obj, "", cols, vals);
  }

  private void extractValues(Object obj, String prefix, List<String> cols, List<Object> vals)
      throws Exception {
    for (Field f : obj.getClass().getDeclaredFields()) {
      f.setAccessible(true);
      cols.add(prefix + "_" + f.getName());
      vals.add(f.get(obj));
    }
  }

  private String toSqlType(Class<?> type) {
    if (type == String.class) return "VARCHAR(255)";
    if (type == int.class || type == Integer.class) return "INT";
    if (type == long.class || type == Long.class) return "BIGINT";
    if (type == double.class || type == Double.class) return "DOUBLE PRECISION";
    return "TEXT";
  }

  public static Map<String, Object> findBestMatch(String inputAddress) throws SQLException {
    String sql =
        """
        SELECT sapo_name as sapo_wardname, 
               sapo_district, 
               sapo_city, 
               sapo_id AS sapo_wardid,
               sapo_districtid,
               sapo_cityid,
               similarity(
                   lower(concat_ws(', ', sapo_name, sapo_district, sapo_city)),
                   lower(?)
               ) AS sim_score
        FROM ward_mapping
        ORDER BY sim_score DESC
        LIMIT 1
    """;

    try (PreparedStatement ps = conn.prepareStatement(sql)) {
      ps.setString(1, inputAddress);

      try (ResultSet rs = ps.executeQuery()) {
        if (rs.next()) {
          Map<String, Object> result = new HashMap<>();
          result.put("sapo_wardname", rs.getString("sapo_wardname"));
          result.put("sapo_district", rs.getString("sapo_district"));
          result.put("sapo_city", rs.getString("sapo_city"));
          result.put("sapo_wardid", rs.getString("sapo_wardid"));
          result.put("sapo_districtid", rs.getString("sapo_districtid"));
          result.put("sapo_cityid", rs.getString("sapo_cityid"));
          result.put("sim_score", rs.getFloat("sim_score"));
          return result;
        }
      }
    }

    return null;
  }
}
