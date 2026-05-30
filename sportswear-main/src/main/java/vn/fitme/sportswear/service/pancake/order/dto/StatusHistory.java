package vn.fitme.sportswear.service.pancake.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StatusHistory {
    private String avatarUrl;
    private Editor editor;
    private String editorFb;
    private String editorId;
    private String name;
    private Integer status;
    private String updatedAt;
}