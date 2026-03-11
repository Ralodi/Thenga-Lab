import { supabase } from '@/lib/supabaseClient';
import { FINALIZED_ORDER_STATUSES, ORDER_STATUS } from '@/types/orderStatus';

export interface AdminWholesaler {
  id: string;
  name: string;
  area: string;
  city: string;
  is_active: boolean;
}

export interface AdminProductType {
  id: string;
  name: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  price: number;
  stock: number;
  unit: string;
  isactive: boolean;
  wholesaler_id: string | null;
  product_type_id: string | null;
  product_type_name: string;
  base_cost: number;
  margin_type: 'fixed' | 'percent';
  margin_value: number;
  category_slug?: string;
  category_name?: string;
  variant_name?: string;
  packaging_name?: string;
  volume_ml?: number | null;
  family_name?: string;
  brand_name?: string;
  available_sizes?: string[];
}

export interface SalesSummary {
  totalSales: number;
  totalOrders: number;
  completedOrders: number;
  topProducts: Array<{ name: string; quantitySold: number }>;
}

export interface SalesTrendPoint {
  date: string;
  sales: number;
  orders: number;
}

export interface StatusFunnelPoint {
  status: string;
  count: number;
}

export interface TopProductRevenuePoint {
  name: string;
  revenue: number;
  quantitySold: number;
}

export interface WholesalerRevenuePoint {
  wholesalerName: string;
  revenue: number;
  orders: number;
}

export interface AreaRevenuePoint {
  area: string;
  revenue: number;
  orders: number;
}

export interface AdminAnalytics {
  salesTrend: SalesTrendPoint[];
  statusFunnel: StatusFunnelPoint[];
  topProductRevenue: TopProductRevenuePoint[];
  wholesalerRevenue: WholesalerRevenuePoint[];
  areaRevenue: AreaRevenuePoint[];
}

export interface WholesalerOwedRow {
  wholesaler_id: string;
  wholesaler_name: string;
  amount_owed: number;
  gross_sales: number;
  total_margin: number;
  delivered_orders: number;
}

export interface DriverOwedRow {
  driver_id: string;
  driver_name: string;
  driver_reg_number: string;
  orders_count: number;
  amount_owed: number;
}

export interface ThengaIncomeSummary {
  margin_income: number;
  delivery_share_income: number;
  total_income: number;
  drivers_total_owed: number;
  drivers_owed_breakdown: DriverOwedRow[];
}

export interface WholesalerInventoryItem {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
  base_cost: number;
  unit_total_sold: number;
  unit_total_cost: number;
  margin_per_unit: number;
  total_margin_on_product: number;
}

export interface WholesalerSettlementDetail {
  wholesaler_id: string;
  wholesaler_name: string;
  inventory_items: WholesalerInventoryItem[];
  total_quantity_sold: number;
  total_sales_revenue: number;
  total_base_cost: number;
  total_margin_earned: number;
  total_delivery_fees_collected: number;
  amount_owed_to_wholesaler: number;
  delivered_orders_count: number;
}

export interface AdminOrder {
  id: string;
  order_id: string;
  customer_name: string;
  contact_number: string;
  location: string;
  status: string;
  total: number;
  delivery_fee: number;
  distance_km: number;
  date: string;
  driver_id: string | null;
}

export interface DeliveredOrderDetails {
  orderDbId: string;
  orderId: string;
  status: string;
  date: string;
  tavernName: string;
  tavernLocation: string;
  tavernContact: string;
  driverId: string | null;
  driverName: string;
  driverRegNumber: string;
  wholesalerNames: string[];
}

export interface AdminDriverProfile {
  id: string;
  user_id: string | null;
  full_name: string;
  contact_number: string;
  car_model: string;
  reg_number: string;
  area: string;
  city: string;
  is_active: boolean;
}

export async function fetchAdminWholesalers(): Promise<AdminWholesaler[]> {
  const { data, error } = await supabase
    .from('wholesalers')
    .select('id, name, area, city, is_active')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminWholesaler[];
}

export async function fetchAdminDriverProfiles(): Promise<AdminDriverProfile[]> {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('id, user_id, full_name, contact_number, car_model, reg_number, area, city, is_active')
    .order('full_name', { ascending: true });

  if (error) {
    const message = error.message || '';
    if (message.includes('column') && (message.includes('area') || message.includes('city'))) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('driver_profiles')
        .select('id, user_id, full_name, contact_number, car_model, reg_number, is_active')
        .order('full_name', { ascending: true });

      if (fallbackError) throw new Error(fallbackError.message);

      return (fallback ?? []).map((item: any) => ({
        ...item,
        area: '',
        city: '',
      })) as AdminDriverProfile[];
    }
    if (message.includes('Could not find the table') || message.includes('does not exist')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((item: any) => ({
    ...item,
    area: item.area ?? '',
    city: item.city ?? '',
  })) as AdminDriverProfile[];
}

export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from('Orders')
    .select('id, order_id, customer_name, contact_number, location, status, total, delivery_fee, distance_km, date, driver_id')
    .order('date', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data ?? []).map((item: any) => ({
    id: String(item.id),
    order_id: String(item.order_id),
    customer_name: String(item.customer_name ?? ''),
    contact_number: String(item.contact_number ?? ''),
    location: String(item.location ?? ''),
    status: String(item.status ?? ''),
    total: Number(item.total ?? 0),
    delivery_fee: Number(item.delivery_fee ?? 0),
    distance_km: Number(item.distance_km ?? 0),
    date: String(item.date ?? ''),
    driver_id: item.driver_id ? String(item.driver_id) : null,
  }));
}

export async function assignOrderDriver(orderDbId: string, driverUserId: string | null): Promise<void> {
  const { error } = await supabase
    .from('Orders')
    .update({ driver_id: driverUserId })
    .eq('id', orderDbId);

  if (error) throw new Error(error.message);
}

export async function fetchDeliveredOrderDetails(orderDbId: string): Promise<DeliveredOrderDetails> {
  const { data: order, error: orderError } = await supabase
    .from('Orders')
    .select('id, order_id, status, date, customer_name, location, contact_number, driver_id')
    .eq('id', orderDbId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Order not found');
  }

  const { data: orderItems, error: orderItemsError } = await supabase
    .from('OrderItems')
    .select('product_id')
    .eq('order_id', orderDbId);

  if (orderItemsError) {
    throw new Error(orderItemsError.message);
  }

  const productIds = Array.from(
    new Set(
      (orderItems ?? [])
        .map((item: any) => String(item.product_id ?? ''))
        .filter(Boolean)
    )
  );

  let wholesalerNames: string[] = [];
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from('Products')
      .select('id, wholesaler_id')
      .in('id', productIds);

    if (productsError) throw new Error(productsError.message);

    const wholesalerIds = Array.from(
      new Set(
        (products ?? [])
          .map((product: any) => String(product.wholesaler_id ?? ''))
          .filter(Boolean)
      )
    );

    if (wholesalerIds.length > 0) {
      const { data: wholesalers, error: wholesalersError } = await supabase
        .from('wholesalers')
        .select('id, name')
        .in('id', wholesalerIds);

      if (wholesalersError) throw new Error(wholesalersError.message);

      wholesalerNames = Array.from(
        new Set((wholesalers ?? []).map((w: any) => String(w.name ?? '')).filter(Boolean))
      );
    }
  }

  let driverName = '';
  let driverRegNumber = '';
  const driverId = order.driver_id ? String(order.driver_id) : null;
  if (driverId) {
    const { data: driverProfile, error: driverError } = await supabase
      .from('driver_profiles')
      .select('full_name, reg_number')
      .eq('user_id', driverId)
      .maybeSingle();

    if (!driverError && driverProfile) {
      driverName = String((driverProfile as any).full_name ?? '');
      driverRegNumber = String((driverProfile as any).reg_number ?? '');
    }
  }

  return {
    orderDbId: String(order.id),
    orderId: String(order.order_id ?? ''),
    status: String(order.status ?? ''),
    date: String(order.date ?? ''),
    tavernName: String(order.customer_name ?? ''),
    tavernLocation: String(order.location ?? ''),
    tavernContact: String(order.contact_number ?? ''),
    driverId,
    driverName,
    driverRegNumber,
    wholesalerNames,
  };
}

export interface DriverProfileUpsertInput {
  id?: string;
  user_id: string | null;
  full_name: string;
  contact_number: string;
  car_model: string;
  reg_number: string;
  area: string;
  city: string;
  is_active: boolean;
}

export async function upsertDriverProfile(input: DriverProfileUpsertInput): Promise<void> {
  const payload = {
    user_id: input.user_id,
    full_name: input.full_name,
    contact_number: input.contact_number,
    car_model: input.car_model,
    reg_number: input.reg_number,
    area: input.area,
    city: input.city,
    is_active: input.is_active,
  };

  if (input.id) {
    const { error } = await supabase.from('driver_profiles').update(payload).eq('id', input.id);
    if (error) {
      if (error.message.includes('column') && (error.message.includes('area') || error.message.includes('city'))) {
        const { error: fallbackError } = await supabase
          .from('driver_profiles')
          .update({
            user_id: input.user_id,
            full_name: input.full_name,
            contact_number: input.contact_number,
            car_model: input.car_model,
            reg_number: input.reg_number,
            is_active: input.is_active,
          })
          .eq('id', input.id);

        if (fallbackError) throw new Error(fallbackError.message);
      } else {
        throw new Error(error.message);
      }
    }
    return;
  }

  const { error } = await supabase.from('driver_profiles').insert([payload]);
  if (error) {
    if (error.message.includes('column') && (error.message.includes('area') || error.message.includes('city'))) {
      const { error: fallbackError } = await supabase.from('driver_profiles').insert([{
        user_id: input.user_id,
        full_name: input.full_name,
        contact_number: input.contact_number,
        car_model: input.car_model,
        reg_number: input.reg_number,
        is_active: input.is_active,
      }]);
      if (fallbackError) throw new Error(fallbackError.message);
    } else {
      throw new Error(error.message);
    }
  }
}

export async function createWholesaler(payload: Omit<AdminWholesaler, 'id'>): Promise<void> {
  const { error } = await supabase.from('wholesalers').insert([payload]);
  if (error) throw new Error(error.message);
}

export async function updateWholesaler(id: string, payload: Omit<AdminWholesaler, 'id'>): Promise<void> {
  const { error } = await supabase.from('wholesalers').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchProductTypes(): Promise<AdminProductType[]> {
  const { data, error } = await supabase
    .from('ProductType')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminProductType[];
}

const enrichProductsWithCatalogFields = async (products: AdminProduct[]): Promise<AdminProduct[]> => {
  if (products.length === 0) return products;

  const { data, error } = await supabase
    .from('vw_catalog_products_phase1')
    .select('product_id, category_slug, category_name, variant_name, packaging_name, volume_ml, family_name, brand_name, available_sizes')
    .in('product_id', products.map((p) => p.id));

  if (error) return products;

  const byProductId = new Map<string, any>();
  for (const row of data ?? []) {
    byProductId.set(String((row as any).product_id ?? ''), row);
  }

  return products.map((product) => {
    const row = byProductId.get(product.id);
    if (!row) return product;

    return {
      ...product,
      category_slug: row.category_slug ? String(row.category_slug) : undefined,
      category_name: row.category_name ? String(row.category_name) : undefined,
      variant_name: row.variant_name ? String(row.variant_name) : undefined,
      packaging_name: row.packaging_name ? String(row.packaging_name) : undefined,
      volume_ml:
        row.volume_ml === null || row.volume_ml === undefined
          ? null
          : Number(row.volume_ml),
      family_name: row.family_name ? String(row.family_name) : undefined,
      brand_name: row.brand_name ? String(row.brand_name) : undefined,
      available_sizes: Array.isArray(row.available_sizes)
        ? row.available_sizes
            .map((size: unknown) => String(size ?? '').trim())
            .filter((size: string) => size.length > 0)
        : undefined,
    };
  });
};

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase
    .from('Products')
    .select(`
      id,
      name,
      description,
      image,
      price,
      base_cost,
      margin_type,
      margin_value,
      stock,
      unit,
      isactive,
      wholesaler_id,
      product_type_id,
      ProductType(name)
    `)
    .order('name', { ascending: true });

  if (error) {
    const message = error.message || '';
    if (message.includes('column') && (message.includes('base_cost') || message.includes('margin_type') || message.includes('margin_value'))) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('Products')
        .select(`
          id,
          name,
          description,
          image,
          price,
          stock,
          unit,
          isactive,
          wholesaler_id,
          product_type_id,
          ProductType(name)
        `)
        .order('name', { ascending: true });
      if (fallbackError) throw new Error(fallbackError.message);
      const mappedFallback = (fallback ?? []).map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        image: item.image ?? '',
        price: Number(item.price ?? 0),
        stock: Number(item.stock ?? 0),
        unit: item.unit ?? 'case',
        isactive: Boolean(item.isactive),
        wholesaler_id: item.wholesaler_id ?? null,
        product_type_id: item.product_type_id ?? null,
        product_type_name: item?.ProductType?.name ?? 'Unknown',
        base_cost: Number(item.price ?? 0),
        margin_type: 'fixed',
        margin_value: 0,
      }));
      return enrichProductsWithCatalogFields(mappedFallback);
    }
    throw new Error(error.message);
  }

  const mapped = (data ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    image: item.image ?? '',
    price: Number(item.price ?? 0),
    stock: Number(item.stock ?? 0),
    unit: item.unit ?? 'case',
    isactive: Boolean(item.isactive),
    wholesaler_id: item.wholesaler_id ?? null,
    product_type_id: item.product_type_id ?? null,
    product_type_name: item?.ProductType?.name ?? 'Unknown',
    base_cost: Number(item.base_cost ?? item.price ?? 0),
    margin_type: item.margin_type === 'percent' ? 'percent' : 'fixed',
    margin_value: Number(item.margin_value ?? 0),
  }));

  return enrichProductsWithCatalogFields(mapped);
}

export interface ProductUpsertInput {
  id?: string;
  name: string;
  family_name?: string;
  brand_name?: string;
  available_sizes?: string[];
  variant_name?: string;
  volume_ml?: number | null;
  description: string;
  image: string;
  price: number;
  stock: number;
  unit: string;
  isactive: boolean;
  wholesaler_id: string | null;
  product_type_id: string | null;
  base_cost: number;
  margin_type: 'fixed' | 'percent';
  margin_value: number;
}

const resolveVariantName = (input: ProductUpsertInput) => {
  if (input.variant_name && input.variant_name.trim().length > 0) return input.variant_name.trim();
  if (input.volume_ml && Number(input.volume_ml) > 0) return `${Number(input.volume_ml)}ml`;
  if (Array.isArray(input.available_sizes) && input.available_sizes.length > 0) {
    const first = String(input.available_sizes[0] ?? '').trim();
    if (first.length > 0) return first;
  }
  return input.unit || 'Standard';
};

const syncCatalogVariantForProduct = async (
  productId: string,
  input: ProductUpsertInput
): Promise<void> => {
  try {
    const familyName = String(input.family_name || input.name || '').trim();
    if (!familyName) return;
    const brandName = String(input.brand_name || '').trim();
    const normalizedSizes = Array.from(
      new Set(
        (Array.isArray(input.available_sizes) ? input.available_sizes : [])
          .map((size) => String(size ?? '').trim())
          .filter((size) => size.length > 0)
      )
    );

    const familyPayloadWithSizes = {
      brand_name: brandName,
      family_name: familyName,
      product_type_id: input.product_type_id,
      description: input.description || '',
      image: input.image || '',
      is_active: input.isactive,
      available_sizes: normalizedSizes,
    };

    let familyRow: { id?: string } | null = null;
    let familyError: { message?: string } | null = null;
    const withSizes = await supabase
      .from('product_families')
      .upsert([familyPayloadWithSizes], { onConflict: 'brand_name,family_name' })
      .select('id')
      .single();
    familyRow = withSizes.data as { id?: string } | null;
    familyError = withSizes.error ? { message: withSizes.error.message } : null;

    if (familyError?.message?.includes('available_sizes')) {
      const fallback = await supabase
        .from('product_families')
        .upsert(
          [
            {
              brand_name: brandName,
              family_name: familyName,
              product_type_id: input.product_type_id,
              description: input.description || '',
              image: input.image || '',
              is_active: input.isactive,
            },
          ],
          { onConflict: 'brand_name,family_name' }
        )
        .select('id')
        .single();
      familyRow = fallback.data as { id?: string } | null;
      familyError = fallback.error ? { message: fallback.error.message } : null;
    }

    if (familyError || !familyRow?.id) {
      const msg = String(familyError?.message || '');
      if (msg.includes('Could not find the table') || msg.includes('does not exist')) return;
      throw new Error(msg || 'Failed to sync product family');
    }

    const safeVolume =
      input.volume_ml === null || input.volume_ml === undefined || Number(input.volume_ml) <= 0
        ? null
        : Math.floor(Number(input.volume_ml));

    const { error: variantError } = await supabase.from('product_variants').upsert(
      [
        {
          family_id: String(familyRow.id),
          product_id: productId,
          variant_name: resolveVariantName(input),
          volume_ml: safeVolume,
          unit_label: input.unit || 'unit',
          is_active: input.isactive,
        },
      ],
      { onConflict: 'product_id' }
    );

    if (variantError) {
      const msg = String(variantError.message || '');
      if (msg.includes('Could not find the table') || msg.includes('does not exist')) return;
      throw variantError;
    }
  } catch (error) {
    const msg = String((error as { message?: string })?.message ?? '');
    if (msg.includes('Could not find the table') || msg.includes('does not exist')) return;
    throw error;
  }
};

export async function upsertProduct(input: ProductUpsertInput): Promise<void> {
  const payload = {
    name: input.name,
    description: input.description,
    image: input.image,
    price: input.price,
    stock: input.stock,
    unit: input.unit,
    isactive: input.isactive,
    wholesaler_id: input.wholesaler_id,
    product_type_id: input.product_type_id,
    base_cost: input.base_cost,
    margin_type: input.margin_type,
    margin_value: input.margin_value,
  };

  if (input.id) {
    const { error } = await supabase.from('Products').update(payload).eq('id', input.id);
    if (error) {
      const message = error.message || '';
      if (message.includes('column') && (message.includes('base_cost') || message.includes('margin_type') || message.includes('margin_value'))) {
        const { error: fallbackError } = await supabase
          .from('Products')
          .update({
            name: input.name,
            description: input.description,
            image: input.image,
            price: input.price,
            stock: input.stock,
            unit: input.unit,
            isactive: input.isactive,
            wholesaler_id: input.wholesaler_id,
            product_type_id: input.product_type_id,
          })
          .eq('id', input.id);
        if (fallbackError) throw new Error(fallbackError.message);
      } else {
        throw new Error(error.message);
      }
    }
    await syncCatalogVariantForProduct(input.id, input);
    return;
  }

  const { data: inserted, error } = await supabase.from('Products').insert([payload]).select('id').single();
  if (error) {
    const message = error.message || '';
    if (message.includes('column') && (message.includes('base_cost') || message.includes('margin_type') || message.includes('margin_value'))) {
      const { data: fallbackInserted, error: fallbackError } = await supabase.from('Products').insert([{
        name: input.name,
        description: input.description,
        image: input.image,
        price: input.price,
        stock: input.stock,
        unit: input.unit,
        isactive: input.isactive,
        wholesaler_id: input.wholesaler_id,
        product_type_id: input.product_type_id,
      }]).select('id').single();
      if (fallbackError) throw new Error(fallbackError.message);
      if (fallbackInserted?.id) {
        await syncCatalogVariantForProduct(String(fallbackInserted.id), input);
      }
    } else {
      throw new Error(error.message);
    }
  } else if (inserted?.id) {
    await syncCatalogVariantForProduct(String(inserted.id), input);
  }
}

export async function updateProductPrice(productId: string, price: number): Promise<void> {
  const { error } = await supabase
    .from('Products')
    .update({ price })
    .eq('id', productId);

  if (error) throw new Error(error.message);
}

export async function uploadProductImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read local image file'));
    reader.readAsDataURL(file);
  });
}

export async function fetchSalesSummary(): Promise<SalesSummary> {
  const { data: orders, error: ordersError } = await supabase
    .from('Orders')
    .select('id, total, status');

  if (ordersError) throw new Error(ordersError.message);

  const { data: orderItems, error: itemsError } = await supabase
    .from('OrderItems')
    .select('name, quantity');

  if (itemsError) throw new Error(itemsError.message);

  const finalizedStatuses = new Set(FINALIZED_ORDER_STATUSES);
  const validOrders = (orders ?? []).filter((o: any) => finalizedStatuses.has(o.status));

  const totalSales = validOrders.reduce((sum: number, order: any) => sum + Number(order.total ?? 0), 0);
  const totalOrders = (orders ?? []).length;
  const completedOrders = (orders ?? []).filter((o: any) => o.status === ORDER_STATUS.COMPLETED).length;

  const byProduct = new Map<string, number>();
  for (const item of orderItems ?? []) {
    const current = byProduct.get(item.name) ?? 0;
    byProduct.set(item.name, current + Number(item.quantity ?? 0));
  }

  const topProducts = Array.from(byProduct.entries())
    .map(([name, quantitySold]) => ({ name, quantitySold }))
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, 5);

  return {
    totalSales: Number(totalSales.toFixed(2)),
    totalOrders,
    completedOrders,
    topProducts,
  };
}

const extractAreaFromLocation = (location?: string | null): string => {
  const raw = String(location ?? '').trim();
  if (!raw) return 'Unknown';

  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[1];
  return parts[0] ?? 'Unknown';
};

const dateKey = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

export async function fetchAdminAnalytics(rangeDays = 14): Promise<AdminAnalytics> {
  const [{ data: orders, error: ordersError }, { data: orderItems, error: orderItemsError }, { data: products, error: productsError }, { data: wholesalers, error: wholesalersError }] =
    await Promise.all([
      supabase.from('Orders').select('id, total, status, date, location'),
      supabase.from('OrderItems').select('order_id, product_id, name, quantity, price'),
      supabase.from('Products').select('id, wholesaler_id'),
      supabase.from('wholesalers').select('id, name'),
    ]);

  if (ordersError) throw new Error(ordersError.message);
  if (orderItemsError) throw new Error(orderItemsError.message);
  if (productsError) throw new Error(productsError.message);
  if (wholesalersError) throw new Error(wholesalersError.message);

  const allOrders = (orders ?? []) as Array<{
    id: string;
    total: number | null;
    status: string | null;
    date: string | null;
    location: string | null;
  }>;
  const allItems = (orderItems ?? []) as Array<{
    order_id: string | null;
    product_id: string | null;
    name: string | null;
    quantity: number | null;
    price: number | null;
  }>;
  const allProducts = (products ?? []) as Array<{ id: string; wholesaler_id: string | null }>;
  const allWholesalers = (wholesalers ?? []) as Array<{ id: string; name: string }>;

  const finalizedStatuses = new Set(FINALIZED_ORDER_STATUSES);
  const finalizedOrders = allOrders.filter((o) => finalizedStatuses.has(String(o.status ?? '')));
  const finalizedOrderIds = new Set(finalizedOrders.map((o) => String(o.id)));

  const wholesalerNameById = new Map<string, string>();
  for (const wholesaler of allWholesalers) {
    wholesalerNameById.set(String(wholesaler.id), String(wholesaler.name));
  }

  const productWholesalerById = new Map<string, string | null>();
  for (const product of allProducts) {
    productWholesalerById.set(String(product.id), product.wholesaler_id ? String(product.wholesaler_id) : null);
  }

  const statusOrder = [
    ORDER_STATUS.CREATED,
    ORDER_STATUS.ACKNOWLEDGED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.REJECTED,
  ];
  const statusCountMap = new Map<string, number>();
  for (const order of allOrders) {
    const status = String(order.status ?? 'Unknown');
    statusCountMap.set(status, (statusCountMap.get(status) ?? 0) + 1);
  }
  const statusFunnel: StatusFunnelPoint[] = [
    ...statusOrder
      .filter((status) => (statusCountMap.get(status) ?? 0) > 0)
      .map((status) => ({ status, count: statusCountMap.get(status) ?? 0 })),
    ...Array.from(statusCountMap.entries())
      .filter(([status]) => !statusOrder.includes(status as any))
      .map(([status, count]) => ({ status, count })),
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trendMap = new Map<string, { sales: number; orders: number }>();
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { sales: 0, orders: 0 });
  }
  for (const order of finalizedOrders) {
    const key = dateKey(String(order.date ?? ''));
    if (!trendMap.has(key)) continue;
    const total = Number(order.total ?? 0);
    const current = trendMap.get(key)!;
    current.sales += total;
    current.orders += 1;
  }
  const salesTrend: SalesTrendPoint[] = Array.from(trendMap.entries()).map(([date, values]) => ({
    date,
    sales: Number(values.sales.toFixed(2)),
    orders: values.orders,
  }));

  const topProductMap = new Map<string, { revenue: number; quantitySold: number }>();
  const wholesalerRevenueMap = new Map<string, { revenue: number; orderKeys: Set<string> }>();
  for (const item of allItems) {
    const orderId = String(item.order_id ?? '');
    if (!orderId || !finalizedOrderIds.has(orderId)) continue;

    const quantity = Number(item.quantity ?? 0);
    const price = Number(item.price ?? 0);
    const revenue = quantity * price;
    const itemName = String(item.name ?? 'Unknown Product');

    const currentProduct = topProductMap.get(itemName) ?? { revenue: 0, quantitySold: 0 };
    currentProduct.revenue += revenue;
    currentProduct.quantitySold += quantity;
    topProductMap.set(itemName, currentProduct);

    const productId = String(item.product_id ?? '');
    const wholesalerId = productWholesalerById.get(productId) ?? null;
    const wholesalerKey = wholesalerId ?? 'unknown';
    const currentWholesaler = wholesalerRevenueMap.get(wholesalerKey) ?? { revenue: 0, orderKeys: new Set<string>() };
    currentWholesaler.revenue += revenue;
    currentWholesaler.orderKeys.add(orderId);
    wholesalerRevenueMap.set(wholesalerKey, currentWholesaler);
  }

  const topProductRevenue: TopProductRevenuePoint[] = Array.from(topProductMap.entries())
    .map(([name, values]) => ({
      name,
      revenue: Number(values.revenue.toFixed(2)),
      quantitySold: values.quantitySold,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const wholesalerRevenue: WholesalerRevenuePoint[] = Array.from(wholesalerRevenueMap.entries())
    .map(([wholesalerId, values]) => ({
      wholesalerName:
        wholesalerId === 'unknown'
          ? 'Unknown wholesaler'
          : wholesalerNameById.get(wholesalerId) ?? wholesalerId,
      revenue: Number(values.revenue.toFixed(2)),
      orders: values.orderKeys.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const areaRevenueMap = new Map<string, { revenue: number; orders: number }>();
  for (const order of finalizedOrders) {
    const area = extractAreaFromLocation(order.location);
    const current = areaRevenueMap.get(area) ?? { revenue: 0, orders: 0 };
    current.revenue += Number(order.total ?? 0);
    current.orders += 1;
    areaRevenueMap.set(area, current);
  }

  const areaRevenue: AreaRevenuePoint[] = Array.from(areaRevenueMap.entries())
    .map(([area, values]) => ({
      area,
      revenue: Number(values.revenue.toFixed(2)),
      orders: values.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    salesTrend,
    statusFunnel,
    topProductRevenue,
    wholesalerRevenue,
    areaRevenue,
  };
}

export async function fetchWholesalerAmountsOwed(): Promise<WholesalerOwedRow[]> {
  const { data, error } = await supabase
    .from('vw_wholesaler_owed_live')
    .select('wholesaler_id, wholesaler_name, amount_owed, gross_sales, total_margin, delivered_orders')
    .order('amount_owed', { ascending: false });

  if (error) {
    const message = error.message || '';
    if (message.includes('Could not find the table') || message.includes('does not exist')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map((row: any) => ({
    wholesaler_id: String(row.wholesaler_id ?? ''),
    wholesaler_name: String(row.wholesaler_name ?? 'Unknown wholesaler'),
    amount_owed: Number(row.amount_owed ?? 0),
    gross_sales: Number(row.gross_sales ?? 0),
    total_margin: Number(row.total_margin ?? 0),
    delivered_orders: Number(row.delivered_orders ?? 0),
  }));
}

export async function fetchThengaIncomeSummary(): Promise<ThengaIncomeSummary> {
  const [{ data: orders, error: ordersError }, { data: orderItems, error: itemsError }, { data: driverProfiles, error: driversError }] =
    await Promise.all([
      supabase.from('Orders').select('id, status, delivery_fee, driver_id'),
      supabase.from('OrderItems').select('order_id, margin_amount_snapshot, price, quantity, wholesaler_payout_snapshot'),
      supabase.from('driver_profiles').select('user_id, full_name, reg_number'),
    ]);

  if (ordersError) throw new Error(ordersError.message);
  if (itemsError) throw new Error(itemsError.message);
  if (driversError) throw new Error(driversError.message);

  const completedOrders = (orders ?? []).filter((order: any) => String(order.status ?? '') === ORDER_STATUS.COMPLETED);
  const completedOrderIds = new Set(completedOrders.map((order: any) => String(order.id)));

  const marginByOrder = new Map<string, number>();
  for (const item of orderItems ?? []) {
    const orderId = String((item as any).order_id ?? '');
    if (!orderId || !completedOrderIds.has(orderId)) continue;

    const explicitMargin = Number((item as any).margin_amount_snapshot);
    const fallbackMargin =
      Number((item as any).price ?? 0) * Number((item as any).quantity ?? 0) -
      Number((item as any).wholesaler_payout_snapshot ?? 0);
    const lineMargin = Number.isFinite(explicitMargin) ? explicitMargin : fallbackMargin;
    marginByOrder.set(orderId, (marginByOrder.get(orderId) ?? 0) + Math.max(0, lineMargin));
  }

  const marginIncome = Number(
    Array.from(marginByOrder.values())
      .reduce((sum, value) => sum + value, 0)
      .toFixed(2)
  );

  const deliveryShareIncome = Number(
    completedOrders
      .reduce((sum: number, order: any) => sum + Number(order.delivery_fee ?? 0) * 0.3, 0)
      .toFixed(2)
  );

  const driversTotalOwed = Number(
    completedOrders
      .reduce((sum: number, order: any) => sum + Number(order.delivery_fee ?? 0) * 0.7, 0)
      .toFixed(2)
  );

  const driverByUserId = new Map<string, { full_name: string; reg_number: string }>();
  for (const driver of driverProfiles ?? []) {
    const userId = String((driver as any).user_id ?? '');
    if (!userId) continue;
    driverByUserId.set(userId, {
      full_name: String((driver as any).full_name ?? ''),
      reg_number: String((driver as any).reg_number ?? ''),
    });
  }

  const breakdownMap = new Map<string, DriverOwedRow>();
  for (const order of completedOrders) {
    const driverId = String((order as any).driver_id ?? '');
    if (!driverId) continue;
    const deliveryFee = Number((order as any).delivery_fee ?? 0);
    const owed = deliveryFee * 0.7;
    const profile = driverByUserId.get(driverId);
    const current = breakdownMap.get(driverId) ?? {
      driver_id: driverId,
      driver_name: profile?.full_name || driverId,
      driver_reg_number: profile?.reg_number || '',
      orders_count: 0,
      amount_owed: 0,
    };
    current.orders_count += 1;
    current.amount_owed += owed;
    breakdownMap.set(driverId, current);
  }

  const driversOwedBreakdown = Array.from(breakdownMap.values())
    .map((row) => ({ ...row, amount_owed: Number(row.amount_owed.toFixed(2)) }))
    .sort((a, b) => b.amount_owed - a.amount_owed);

  return {
    margin_income: marginIncome,
    delivery_share_income: deliveryShareIncome,
    total_income: Number((marginIncome + deliveryShareIncome).toFixed(2)),
    drivers_total_owed: driversTotalOwed,
    drivers_owed_breakdown: driversOwedBreakdown,
  };
}

export async function fetchWholesalerSettlementDetails(): Promise<WholesalerSettlementDetail[]> {
  try {
    // Fetch all delivered orders with items
    const { data: orders, error: ordersError } = await supabase
      .from('Orders')
      .select('id, status, wholesaler_id, delivery_fee')
      .in('status', FINALIZED_ORDER_STATUSES);
    if (ordersError) throw new Error(`Orders fetch error: ${ordersError.message}`);

    // debugging logs
    console.debug('fetchWholesalerSettlementDetails - orders fetched', orders?.length, orders);

    const completedOrderIds = (orders ?? []).map((o: any) => String(o.id));

    if (completedOrderIds.length === 0) {
      return [];
    }

    // Fetch order items with snapshots
    const { data: orderItems, error: itemsError } = await supabase
      .from('OrderItems')
      .select(`
        id,
        order_id,
        product_id,
        product_name,
        quantity,
        price,
        wholesaler_id,
        base_cost_snapshot,
        margin_type_snapshot,
        margin_value_snapshot,
        margin_amount_snapshot,
        wholesaler_payout_snapshot
      `)
      .in('order_id', completedOrderIds);

    if (itemsError) throw new Error(`OrderItems fetch error: ${itemsError.message}`);
    console.debug('fetchWholesalerSettlementDetails - orderItems fetched', orderItems?.length, orderItems);

    // Fetch wholesalers for name mapping
    const { data: wholesalers, error: wholesalersError } = await supabase
      .from('wholesalers')
      .select('id, name');

    if (wholesalersError) throw new Error(`Wholesalers fetch error: ${wholesalersError.message}`);

    const wholesalerMap = new Map<string, string>();
    (wholesalers ?? []).forEach((w: any) => {
      wholesalerMap.set(String(w.id ?? ''), String(w.name ?? 'Unknown'));
    });

    // Fetch delivery fees per order
    const deliveryFeeMap = new Map<string, number>();
    (orders ?? []).forEach((o: any) => {
      deliveryFeeMap.set(String(o.id ?? ''), Number(o.delivery_fee ?? 0));
    });

    // Group by wholesaler
    const settlementMap = new Map<string, {
      items: Map<string, WholesalerInventoryItem>;
      total_sales: number;
      total_cost: number;
      total_margin: number;
      total_delivery: number;
      order_ids: Set<string>;
    }>();

    for (const item of orderItems ?? []) {
      const wholesalerId = String(item.wholesaler_id ?? '');
      const productId = String(item.product_id ?? '');
      const productName = String(item.product_name ?? '');
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.price ?? 0);
      const baseCost = Number(item.base_cost_snapshot ?? 0);
      
      // Calculate margin
      let marginAmount = 0;
      const explicitMargin = Number(item.margin_amount_snapshot);
      if (Number.isFinite(explicitMargin) && explicitMargin > 0) {
        marginAmount = explicitMargin;
      } else {
        marginAmount = Math.max(0, unitPrice * quantity - (Number(item.wholesaler_payout_snapshot ?? 0)));
      }

      const sales = unitPrice * quantity;
      const cost = baseCost * quantity;

      if (!settlementMap.has(wholesalerId)) {
        settlementMap.set(wholesalerId, {
          items: new Map(),
          total_sales: 0,
          total_cost: 0,
          total_margin: 0,
          total_delivery: 0,
          order_ids: new Set(),
        });
      }

      const settlement = settlementMap.get(wholesalerId)!;
      settlement.total_sales += sales;
      settlement.total_cost += cost;
      settlement.total_margin += marginAmount;
      settlement.order_ids.add(String(item.order_id ?? ''));

      if (settlement.items.has(productId)) {
        const existing = settlement.items.get(productId)!;
        existing.quantity_sold += quantity;
        existing.unit_total_sold += sales;
        existing.unit_total_cost += cost;
        existing.total_margin_on_product += marginAmount;
      } else {
        settlement.items.set(productId, {
          product_id: productId,
          product_name: productName,
          quantity_sold: quantity,
          unit_price: unitPrice,
          base_cost: baseCost,
          unit_total_sold: sales,
          unit_total_cost: cost,
          margin_per_unit: unitPrice - baseCost,
          total_margin_on_product: marginAmount,
        });
      }
    }

    // Calculate delivery fees per wholesaler and convert to array
    const result: WholesalerSettlementDetail[] = [];

    for (const [wholesalerId, data] of settlementMap.entries()) {
      let totalDeliveryFee = 0;
      for (const orderId of data.order_ids) {
        totalDeliveryFee += deliveryFeeMap.get(orderId) ?? 0;
      }

      const amountOwed = Number((data.total_cost).toFixed(2));

      result.push({
        wholesaler_id: wholesalerId,
        wholesaler_name: wholesalerMap.get(wholesalerId) ?? 'Unknown Wholesaler',
        inventory_items: Array.from(data.items.values()).map(item => ({
          ...item,
          unit_total_sold: Number(item.unit_total_sold.toFixed(2)),
          unit_total_cost: Number(item.unit_total_cost.toFixed(2)),
          margin_per_unit: Number(item.margin_per_unit.toFixed(2)),
          total_margin_on_product: Number(item.total_margin_on_product.toFixed(2)),
        })),
        total_quantity_sold: data.items.values().length,
        total_sales_revenue: Number(data.total_sales.toFixed(2)),
        total_base_cost: Number(data.total_cost.toFixed(2)),
        total_margin_earned: Number(data.total_margin.toFixed(2)),
        total_delivery_fees_collected: Number(totalDeliveryFee.toFixed(2)),
        amount_owed_to_wholesaler: amountOwed,
        delivered_orders_count: data.order_ids.size,
      });
    }

    return result.sort((a, b) => b.amount_owed_to_wholesaler - a.amount_owed_to_wholesaler);
  } catch (error) {
    console.error('Error fetching wholesaler settlement details:', error);
    return [];
  }
}
