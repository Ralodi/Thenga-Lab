import { Product } from "../data/products";

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  variantId?: string;        // NEW: Reference to specific variant if multi-size product
  variantPrice?: number;     // NEW: Actual price of the selected variant
}

export interface CustomerInfo {
  userId?: string;
  name: string;
  location: string;
  contactNumber: string;
  addressId?: string;
}

export interface Order {
  items: CartItem[];
  customer: CustomerInfo;
  subtotal: number;
  deliveryFee: number;
  distanceKm: number;
  loyaltyPointsRedeemed?: number;
  loyaltyRedemptionValue?: number;
  loyaltyPointsEarned?: number;
  loyaltyBasePointsEarned?: number;
  loyaltyBonusPointsEarned?: number;
  loyaltyPointsTotal?: number | null;
  total: number;
  date: string;
  orderId: string;
}
