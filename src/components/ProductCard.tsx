
import React, { useEffect, useMemo, useState } from 'react';
import { Product, ProductVariant } from '../data/products';
import { useCartStore } from '../store/useCartStore';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  variants?: Product[];
}

const ProductCard: React.FC<ProductCardProps> = ({ product, variants }) => {
  const [quantity, setQuantity] = useState(1);
  const normalizedVariants = useMemo(
    () =>
      (variants && variants.length > 0 ? variants : [product]).slice().sort((a, b) => {
        const aVol = Number(a.volume_ml ?? 0);
        const bVol = Number(b.volume_ml ?? 0);
        if (aVol !== bVol) return bVol - aVol;
        return a.name.localeCompare(b.name);
      }),
    [product, variants]
  );
  
  const variantSizeLabel = (item: Product) => {
    if (item.volume_ml && Number(item.volume_ml) > 0) return `${Number(item.volume_ml)}ml`;
    if (item.variant_name && item.variant_name.trim().length > 0) return item.variant_name.trim();
    return item.unit || 'Standard';
  };
  
  const uniqueNormalizedSizes = (input: string[]) => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of input) {
      const label = String(raw ?? '').trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(label);
    }
    return list;
  };
  
  const normalizeSize = (value?: string) => String(value ?? '').trim().toLowerCase();
  
  const derivedSizeOptions = useMemo(
    () => normalizedVariants.map((item) => variantSizeLabel(item)),
    [normalizedVariants]
  );
  
  const configuredSizes = useMemo(
    () =>
      uniqueNormalizedSizes([
        ...(Array.isArray(product.available_sizes) ? product.available_sizes : []),
        ...normalizedVariants.flatMap((item) =>
          Array.isArray(item.available_sizes) ? item.available_sizes : []
        ),
      ]),
    [product.available_sizes, normalizedVariants]
  );
  
  const sizeOptions = useMemo(
    () =>
      (configuredSizes.length > 0 ? configuredSizes : derivedSizeOptions)
        .map((size) => String(size).trim())
        .filter(
          (size, index, list) =>
            size.length > 0 &&
            list.findIndex((s) => normalizeSize(s) === normalizeSize(size)) === index
        ),
    [configuredSizes, derivedSizeOptions]
  );
  
  const [selectedSize, setSelectedSize] = useState<string>(sizeOptions[0] ?? derivedSizeOptions[0] ?? 'Standard');
  
  // NEW: Find selected variant and check for product variants
  const selectedVariant = normalizedVariants.find(
    (item) => normalizeSize(variantSizeLabel(item)) === normalizeSize(selectedSize)
  ) ?? normalizedVariants[0] ?? product;
  
  // NEW: Determine selected variant ID and price from product.variants if available
  const selectedVariantData = useMemo(() => {
    if (product.variants && product.variants.length > 0) {
      const matched = product.variants.find(
        (v) => normalizeSize(v.size) === normalizeSize(selectedSize)
      );
      if (matched) {
        return {
          variantId: matched.id,
          variantPrice: matched.price,
          variantSize: matched.size,
        };
      }
    }
    return null;
  }, [product.variants, selectedSize]);
  
  const { addToCart } = useCartStore();
  const { toast } = useToast();

  useEffect(() => {
    setSelectedSize(sizeOptions[0] ?? derivedSizeOptions[0] ?? 'Standard');
  }, [product.id, normalizedVariants, sizeOptions, derivedSizeOptions]);

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handleAddToCart = () => {
    // NEW: Pass variant ID and price if available
    const finalPrice = selectedVariantData?.variantPrice ?? selectedVariant.price;
    const finalVariantId = selectedVariantData?.variantId ?? undefined;
    
    addToCart(
      selectedVariant, 
      quantity, 
      selectedSize,
      finalVariantId,
      finalPrice
    );
    
    toast({
      title: "Added to cart",
      description: `${quantity} x ${selectedVariant.name}${selectedSize ? ` (${selectedSize})` : ''} @ R ${finalPrice.toFixed(2)} each`,
    });
    setQuantity(1);
  };

  const detailParts = [
    selectedVariant.variant_name,
    selectedVariant.volume_ml ? `${selectedVariant.volume_ml}ml` : null,
    selectedVariant.packaging_name,
  ].filter(Boolean);
  
  // NEW: Use variant price if available, otherwise use product price
  const displayPrice = selectedVariantData?.variantPrice ?? selectedVariant.price;

  return (
    <div className="product-card flex flex-col h-full border border-thenga-lightgray">
      <div className="flex-grow">
        <img 
          src={selectedVariant.image || '/products/placeholder.svg'} 
          alt={selectedVariant.name}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/products/placeholder.svg';
          }}
          className="product-image"
        />
        <h3 className="text-lg font-bold text-thenga-blue">{product.family_name || product.name}</h3>
        <p className="text-sm text-gray-600 mb-2">{selectedVariant.description}</p>
        
        {sizeOptions.length > 1 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {sizeOptions.map((size) => {
              const selected = normalizeSize(size) === normalizeSize(selectedSize);
              // look up variant data from the normalizedVariants list rather than
              // falling back to whatever variant happens to be selected
              const variantForSize = normalizedVariants.find(
                (item) => normalizeSize(variantSizeLabel(item)) === normalizeSize(size)
              );
              const price = variantForSize?.price ?? product.price;

              return (
                <button
                  key={size}
                  type="button"
                  className={`px-2 py-1 text-xs rounded border flex flex-col items-center ${
                    selected
                      ? "bg-thenga-blue text-white border-thenga-blue"
                      : "bg-white text-gray-700 border-thenga-lightgray hover:border-thenga-blue"
                  }`}
                  onClick={() => setSelectedSize(size)}
                  title={`${size} - R ${price.toFixed(2)}`}
                >
                  <span>{size}</span>
                  <span className="text-xs opacity-75">R {price.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        )}
        
        {detailParts.length > 0 && (
          <p className="text-xs text-gray-500 mb-2">{detailParts.join(' | ')}</p>
        )}
        
        <p className="text-lg font-semibold text-thenga-blue">R {displayPrice.toFixed(2)}</p>
      </div>
      
      <div className="mt-4">
        <div className="quantity-control mb-3">
          <button 
            className="quantity-btn" 
            onClick={handleDecrement}
            aria-label="Decrease quantity"
          >
            <Minus size={16} />
          </button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            className="quantity-input"
          />
          <button 
            className="quantity-btn" 
            onClick={handleIncrement}
            aria-label="Increase quantity"
          >
            <Plus size={16} />
          </button>
        </div>
        
        <Button 
          onClick={handleAddToCart}
          className="w-full bg-thenga-blue hover:bg-thenga-lightblue text-white"
        >
          <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;
