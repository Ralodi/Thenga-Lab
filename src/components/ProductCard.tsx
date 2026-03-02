
import React, { useState } from 'react';
import { Product } from '../data/products';
import { useCartStore } from '../store/useCartStore';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCartStore();
  const { toast } = useToast();

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    toast({
      title: "Added to cart",
      description: `${quantity} x ${product.name}`,
    });
    setQuantity(1);
  };

  return (
    <div className="product-card flex flex-col h-full border border-thenga-lightgray">
      <div className="flex-grow">
        <img 
          src={product.image || '/products/placeholder.svg'} 
          alt={product.name}
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/products/placeholder.svg';
          }}
          className="product-image"
        />
        <h3 className="text-lg font-bold text-thenga-blue">{product.name}</h3>
        <p className="text-sm text-gray-600 mb-2">{product.description}</p>
        <p className="text-lg font-semibold text-thenga-blue">R {product.price.toFixed(2)}</p>
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
