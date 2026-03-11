// Product Variant - represents a specific size/variant with its own price
export interface ProductVariant {
  id: string;
  productId: string;
  size: string;        // e.g. "330ml Dumpy", "500ml Can", "750ml Quart"
  price: number;
  sku?: string;
  stock?: number;
}

// Enhanced Product type to support variants and wholesaler association
export interface EnhancedProduct {
  id: string;
  name: string;
  type: string;
  image: string;
  description: string;
  price: number;              // Keep for backward compatibility (default/first variant)
  stock: number;              // Keep for backward compatibility
  unit: string;
  category_slug?: string;
  category_name?: string;
  variant_name?: string;
  packaging_code?: string;
  packaging_name?: string;
  volume_ml?: number | null;
  family_name?: string;
  brand_name?: string;
  available_sizes?: string[];
  wholesalerId?: string;      // NEW: Associate product with specific wholesaler
  variants?: ProductVariant[]; // NEW: Multiple sizes with different prices
}
