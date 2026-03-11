
import { EnhancedProduct, ProductVariant } from '@/types/product';

// For backward compatibility, Product is now an alias for EnhancedProduct
export type Product = EnhancedProduct;

// Re-export variant type
export type { ProductVariant };
