package vn.fitme.sportswear.service.shopify.model;

import lombok.Getter;
import lombok.Setter;

import javax.xml.bind.annotation.XmlRootElement;

@Setter
@Getter
@XmlRootElement
public class ShopifyErrorsRoot {

	private String errors;

}
