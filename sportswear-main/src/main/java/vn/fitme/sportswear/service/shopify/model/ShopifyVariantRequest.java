package vn.fitme.sportswear.service.shopify.model;

public interface ShopifyVariantRequest {

	public ShopifyVariant getRequest();

	public String getImageSource();

	public boolean hasImageSource();

	public boolean hasChanged();

}
