import { Product } from "@/data/products";
import { supabaseUrl, supabaseAnonKey, supabase } from "@/lib/supabaseClient";
import { Order } from "@/types/cart";

const isUuid = (value?: string): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export async function submitOrder(order: Order) {
  const safeUserId = isUuid(order.customer.userId) ? order.customer.userId : undefined;
  const safeAddressId = isUuid(order.customer.addressId) ? order.customer.addressId : undefined;
  
  // Refresh session to ensure we have a valid, current access token
  const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error('Session refresh failed:', refreshError);
    throw new Error('Authentication expired. Please log out and log back in.');
  }
  const accessToken = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  console.log('Submitting order with headers:', { hasAuth: !!accessToken, hasApikey: !!headers.apikey });

  const response = await fetch(`${supabaseUrl}/functions/v1/create-order`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer_name: order.customer.name,
      location: order.customer.location,
      contact_number: order.customer.contactNumber,
      user_id: safeUserId,
      address_id: safeAddressId,
      distance_km: order.distanceKm,
      points_to_redeem: Math.max(0, Math.floor(Number(order.loyaltyPointsRedeemed ?? 0))),
      items: order.items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        size: item.selectedSize ?? null,
      })),
    }),
  });

  const rawBody = await response.text();
  let result: any = null;
  try {
    result = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    result = null;
  }

  if (!response.ok) {
    const fallbackMessage = rawBody?.trim().length
      ? rawBody
      : `Secure order creation failed (${response.status})`;
    throw new Error(result?.error || fallbackMessage);
  }

  const serverOrder = result?.order;
  if (!serverOrder?.order_id) {
    throw new Error('Secure order creation returned an invalid response');
  }

  order.orderId = String(serverOrder.order_id);
  order.date = String(serverOrder.date || order.date);
  order.subtotal = Number(serverOrder.subtotal ?? order.subtotal);
  order.deliveryFee = Number(serverOrder.delivery_fee ?? order.deliveryFee);
  order.distanceKm = Number(serverOrder.distance_km ?? order.distanceKm);
  order.total = Number(serverOrder.total ?? order.total);
  order.loyaltyPointsRedeemed = Number(result?.loyalty?.redeemed ?? 0);
  order.loyaltyRedemptionValue = Number(result?.loyalty?.redemption_value ?? 0);
  order.loyaltyPointsEarned = Number(result?.loyalty?.earned ?? 0);
  order.loyaltyBasePointsEarned = Number(result?.loyalty?.base_earned ?? 0);
  order.loyaltyBonusPointsEarned = Number(result?.loyalty?.bonus_earned ?? 0);
  order.loyaltyPointsTotal =
    result?.loyalty?.total === null || result?.loyalty?.total === undefined
      ? null
      : Number(result.loyalty.total);
}

export const fetchOrderById = async (orderId: string) => {
  const { data, error } = await supabase
    .from('Orders')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const subscribeToOrderUpdates = (
  orderId: string,
  onUpdate: (updatedOrder: any) => void
) => {
  const channel = supabase
    .channel(`order-updates-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Orders',
        filter: `order_id=eq.${orderId}`,
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export async function sendOrderEmail(orderId: string, customerName: string) {
  const supabaseFunctionUrl = `${supabaseUrl}/functions/v1/send-order-email`;

  try {
    const response = await fetch(supabaseFunctionUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        customer_name: customerName,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${orderId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error calling function:', error);
    throw error;
  }
}

export interface CustomerOrderHistoryItem {
  id: string;
  order_id: string;
  status: string;
  date: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  distance_km: number;
  location: string;
  customer_name: string;
  contact_number: string;
  loyalty_points_redeemed: number;
  loyalty_redemption_value: number;
}

interface FetchCustomerOrdersInput {
  userId?: string;
  customerName?: string;
  contactNumber?: string;
}

interface FetchCustomerLoyaltyInput extends FetchCustomerOrdersInput {}

export interface LoyaltyTransactionItem {
  id: string;
  order_id: string;
  points_earned: number;
  points_earned_base: number;
  points_earned_bonus: number;
  points_redeemed: number;
  redemption_value: number;
  order_total: number;
  created_at: string;
}

const normalizeText = (value?: string) => String(value ?? '').trim().toLowerCase();
const buildLoyaltyKey = (input: FetchCustomerLoyaltyInput) => {
  if (isUuid(input.userId)) return `user:${input.userId}`;
  const safeContact = normalizeText(input.contactNumber).replace(/\s+/g, '');
  const safeName = normalizeText(input.customerName).replace(/\s+/g, ' ');
  if (!safeContact || !safeName) return '';
  return `guest:${safeContact}|${safeName}`;
};

export async function fetchCustomerOrders(input: FetchCustomerOrdersInput): Promise<CustomerOrderHistoryItem[]> {
  const hasUserId = isUuid(input.userId);
  const baseSelect =
    'id, order_id, status, date, total, subtotal, delivery_fee, distance_km, location, customer_name, contact_number';
  const extendedSelect = `${baseSelect}, loyalty_points_redeemed, loyalty_redemption_value`;

  const buildQuery = (selectColumns: string) => {
    let query = supabase
      .from('Orders')
      .select(selectColumns)
      .order('date', { ascending: false })
      .limit(100);

    if (hasUserId) {
      query = query.eq('user_id', input.userId as string);
    } else if (input.contactNumber && input.contactNumber.trim().length > 0) {
      query = query.eq('contact_number', input.contactNumber.trim());
      if (input.customerName && input.customerName.trim().length > 0) {
        query = query.eq('customer_name', input.customerName.trim());
      }
    }

    return query;
  };

  if (!hasUserId && !(input.contactNumber && input.contactNumber.trim().length > 0)) {
    return [];
  }

  let { data, error } = await buildQuery(extendedSelect);
  if (error) {
    const msg = String(error.message || '');
    const missingRedemptionColumns =
      msg.includes('loyalty_points_redeemed') || msg.includes('loyalty_redemption_value');

    if (missingRedemptionColumns) {
      const fallback = await buildQuery(baseSelect);
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) throw new Error(error.message);

  return (data ?? []).map((item) => ({
    id: String(item.id),
    order_id: String(item.order_id),
    status: String(item.status),
    date: String(item.date),
    total: Number(item.total ?? 0),
    subtotal: Number(item.subtotal ?? 0),
    delivery_fee: Number(item.delivery_fee ?? 0),
    distance_km: Number(item.distance_km ?? 0),
    location: String(item.location ?? ''),
    customer_name: String(item.customer_name ?? ''),
    contact_number: String(item.contact_number ?? ''),
    loyalty_points_redeemed: Number((item as { loyalty_points_redeemed?: number }).loyalty_points_redeemed ?? 0),
    loyalty_redemption_value: Number((item as { loyalty_redemption_value?: number }).loyalty_redemption_value ?? 0),
  }));
}

export async function fetchCustomerLoyaltyTotal(
  input: FetchCustomerLoyaltyInput
): Promise<number | null> {
  const loyaltyKey = buildLoyaltyKey(input);
  if (!loyaltyKey) return null;

  const { data, error } = await supabase
    .from('customer_loyalty')
    .select('total_points')
    .eq('loyalty_key', loyaltyKey)
    .maybeSingle();

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('Could not find the table') || msg.includes('does not exist')) {
      return null;
    }
    throw new Error(error.message);
  }

  return data ? Number(data.total_points ?? 0) : 0;
}

export async function fetchCustomerLoyaltyHistory(
  input: FetchCustomerLoyaltyInput
): Promise<LoyaltyTransactionItem[]> {
  const loyaltyKey = buildLoyaltyKey(input);
  if (!loyaltyKey) return [];

  const { data, error } = await supabase
    .from('loyalty_points_ledger')
    .select(
      'id, order_id, points_earned, points_earned_base, points_earned_bonus, points_redeemed, redemption_value, order_total, created_at'
    )
    .eq('loyalty_key', loyaltyKey)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    const msg = String(error.message || '');
    if (msg.includes('Could not find the table') || msg.includes('does not exist')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => ({
    id: String(item.id),
    order_id: String(item.order_id ?? ''),
    points_earned: Number(item.points_earned ?? 0),
    points_earned_base: Number(item.points_earned_base ?? 0),
    points_earned_bonus: Number(item.points_earned_bonus ?? 0),
    points_redeemed: Number(item.points_redeemed ?? 0),
    redemption_value: Number(item.redemption_value ?? 0),
    order_total: Number(item.order_total ?? 0),
    created_at: String(item.created_at ?? ''),
  }));
}
