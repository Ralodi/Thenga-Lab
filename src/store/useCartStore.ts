import { create } from 'zustand';
import { Product } from '../data/products';
import { CartItem, CustomerInfo, Order } from '../types/cart';
import { sendOrderEmail, submitOrder } from '@/services/orderService';
import { calculateDeliveryFee } from '@/lib/deliveryPricing';

interface DeliveryPricingInput {
  distanceKm: number;
  deliveryFee?: number;
  pointsToRedeem?: number;
}

interface CartStore {
  items: CartItem[];
  addToCart: (product: Product, quantity: number, selectedSize?: string, variantId?: string, variantPrice?: number) => void;
  updateQuantity: (productId: string, quantity: number, selectedSize?: string, variantId?: string) => void;
  removeItem: (productId: string, selectedSize?: string, variantId?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  submitOrder: (customerInfo: CustomerInfo, deliveryPricing: DeliveryPricingInput) => Promise<Order>;
}

const normalizeSize = (value?: string) => String(value ?? '').trim().toLowerCase();
const normalizeVariantId = (value?: string) => String(value ?? '').trim();

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addToCart: (product: Product, quantity: number, selectedSize?: string, variantId?: string, variantPrice?: number) => {
    const normalizedSize = normalizeSize(selectedSize);
    const normalizedVariantId = normalizeVariantId(variantId);
    
    set((state) => {
      const existingItemIndex = state.items.findIndex(
        (item) =>
          item.product.id === product.id &&
          normalizeSize(item.selectedSize) === normalizedSize &&
          normalizeVariantId(item.variantId) === normalizedVariantId
      );

      if (existingItemIndex !== -1) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex].quantity += quantity;
        return { items: updatedItems };
      } else {
        return {
          items: [
            ...state.items,
            {
              product,
              quantity,
              selectedSize: selectedSize && selectedSize.trim().length > 0 ? selectedSize.trim() : undefined,
              variantId: variantId && variantId.trim().length > 0 ? variantId.trim() : undefined,
              variantPrice: typeof variantPrice === 'number' ? variantPrice : undefined,
            },
          ],
        };
      }
    });
  },

  updateQuantity: (productId: string, quantity: number, selectedSize?: string, variantId?: string) => {
    const normalizedSize = normalizeSize(selectedSize);
    const normalizedVariantId = normalizeVariantId(variantId);
    
    set((state) => {
      const updatedItems = state.items.map((item) => {
        if (
          item.product.id === productId &&
          normalizeSize(item.selectedSize) === normalizedSize &&
          normalizeVariantId(item.variantId) === normalizedVariantId
        ) {
          return { ...item, quantity: Math.max(1, quantity) };
        }
        return item;
      });
      return { items: updatedItems };
    });
  },

  removeItem: (productId: string, selectedSize?: string, variantId?: string) => {
    const normalizedSize = normalizeSize(selectedSize);
    const normalizedVariantId = normalizeVariantId(variantId);
    
    set((state) => ({
      items: state.items.filter(
        (item) =>
          !(
            item.product.id === productId &&
            normalizeSize(item.selectedSize) === normalizedSize &&
            normalizeVariantId(item.variantId) === normalizedVariantId
          )
      ),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getTotal: () => {
    return get().items.reduce((total, item) => {
      // Use variant price if available, otherwise fall back to product price
      const itemPrice = typeof item.variantPrice === 'number' ? item.variantPrice : item.product.price;
      return total + itemPrice * item.quantity;
    }, 0);
  },

  submitOrder: async (customerInfo: CustomerInfo, deliveryPricing: DeliveryPricingInput) => {
    const items = get().items;
    const subtotal = get().getTotal();
    const distanceKm = deliveryPricing.distanceKm;
    const deliveryFee = deliveryPricing.deliveryFee ?? calculateDeliveryFee(distanceKm);
    const pointsToRedeem = Math.max(0, Math.floor(Number(deliveryPricing.pointsToRedeem ?? 0)));
    const total = subtotal + deliveryFee;
    const date = new Date().toISOString();
    const orderId = `ORD-${Date.now()}`;

    const order: Order = {
      items,
      customer: customerInfo,
      subtotal,
      deliveryFee,
      distanceKm,
      loyaltyPointsRedeemed: pointsToRedeem,
      total,
      date,
      orderId,
    };

    await submitOrder(order);
    try {
      await sendOrderEmail(order.orderId, customerInfo.name);
    } catch (error) {
      console.error('Order email failed, continuing without blocking checkout:', error);
    }

    return order;
  },
}));

