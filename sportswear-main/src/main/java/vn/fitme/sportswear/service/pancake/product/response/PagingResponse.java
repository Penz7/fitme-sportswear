package vn.fitme.sportswear.service.pancake.product.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PagingResponse<T> {
    private List<T> data;
    private Long pageNumber;
    private Long pageSize;
    private Boolean success;
    private Long totalEntries;
    private Long totalPages;
}
