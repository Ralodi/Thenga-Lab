
import { Product } from "../data/products";

export interface CartItem {
  product: Product;
  quantity: number;
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
  total: number;
  date: string;
  orderId: string;
}
