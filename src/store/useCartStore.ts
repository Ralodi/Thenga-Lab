
import { create } from 'zustand';
import { Product } from '../data/products';
import { CartItem, CustomerInfo, Order } from '../types/cart';
import { sendOrderEmail, submitOrder } from '@/services/orderService';

interface CartStore {
  items: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  submitOrder: (customerInfo: CustomerInfo) => Promise<Order>;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addToCart: (product: Product, quantity: number) => {
    set((state) => {
      const existingItemIndex = state.items.findIndex(
        (item) => item.product.id === product.id
      );

      if (existingItemIndex !== -1) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex].quantity += quantity;
        return { items: updatedItems };
      } else {
        return {
          items: [...state.items, { product, quantity }],
        };
      }
    });
  },

  updateQuantity: (productId: string, quantity: number) => {
    set((state) => {
      const updatedItems = state.items.map((item) => {
        if (item.product.id === productId) {
          return { ...item, quantity: Math.max(1, quantity) };
        }
        return item;
      });
      return { items: updatedItems };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getTotal: () => {
    return get().items.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );
  },

  submitOrder: async (customerInfo: CustomerInfo) => {
    const items = get().items;
    const total = get().getTotal();
    const date = new Date().toISOString();
    const orderId = `ORD-${Date.now()}`;
    const { v4: uuidv4 } = await import('uuid');
    const deliveryid = uuidv4();

    const order: Order = {
      items,
      customer: customerInfo,
      total,
      date,
      orderId
    };

    // Generate Order
    await submitOrder(order, customerInfo);

    // Send order confirmation email
    await sendOrderEmail(orderId, customerInfo.name);
    
    return order;
  }
}));

