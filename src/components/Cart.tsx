import React from 'react';
import { useCartStore } from '../store/useCartStore';
import { XCircle, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CartProps {
  onCheckout: () => void;
  isLoggedIn: boolean;
  onLogin: () => void; // Uncomment if you want to handle login directly from Cart
}

const Cart: React.FC<CartProps> = ({ onCheckout, isLoggedIn, onLogin }) => {
  const { items, updateQuantity, removeItem, getTotal } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="text-center p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-thenga-blue mb-4">Your Cart</h2>
        <p className="text-gray-500">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Cart Items */}
      <div className="flex-1 overflow-y-auto pr-1">
        <h2 className="text-xl font-bold text-thenga-blue mb-4">Your Cart</h2>

        {items.map((item) => (
          <div key={item.product.id} className="mb-4">
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <h3 className="font-medium">{item.product.name}</h3>
                <p className="text-sm text-gray-500">R {item.product.price.toFixed(2)} each</p>
              </div>

              <div className="flex items-center">
                <button
                  className="p-1 bg-thenga-lightgray hover:bg-thenga-yellow rounded-l"
                  onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                >
                  <Minus size={16} />
                </button>
                <span className="px-2 py-1 border-y border-thenga-lightgray bg-white min-w-[2.5rem] text-center">
                  {item.quantity}
                </span>
                <button
                  className="p-1 bg-thenga-lightgray hover:bg-thenga-yellow rounded-r"
                  onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="ml-4 flex items-center">
                <span className="font-medium mr-2">
                  R {(item.product.price * item.quantity).toFixed(2)}
                </span>
                <button
                  onClick={() => removeItem(item.product.id)}
                  className="text-gray-500 hover:text-red-500"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <Separator className="mt-2" />
          </div>
        ))}
      </div>

      {/* Fixed Footer */}
      {
        isLoggedIn ? (
          <div className="border-t mt-4 pt-4 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold text-lg">Total:</span>
              <span className="font-bold text-xl text-thenga-blue">
                R {getTotal().toFixed(2)}
              </span>
            </div>

            <Button
              onClick={onCheckout}
              className="w-full bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold py-3 px-4 rounded-md shadow-md"
              size="lg"
            >
              Proceed to Checkout
            </Button>
          </div>
        ) : (
          <div className="p-4 bg-white border-t">
            <p className="text-sm text-gray-600 mb-2">Please log in to proceed with checkout</p>
            <Button
              onClick={onLogin}
              className="w-full bg-thenga-yellow hover:bg-thenga-yellow/90 text-thenga-blue font-bold py-2 px-4 rounded-md shadow-md"
            >
              Log In
            </Button>
          </div>
        )
      }
    </div>
  );
};

export default Cart;
