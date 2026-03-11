import { supabase } from '@/lib/supabaseClient';
import { ORDER_STATUS } from '@/types/orderStatus';

export interface DriverTrip {
  id: string;
  order_id: string;
  date: string;
  location: string;
  status: string;
  distance_km: number;
  delivery_fee: number;
  total: number;
}

export interface DriverStats {
  totalTrips: number;
  completedTrips: number;
  totalDistanceKm: number;
  totalDriverEarnings: number;
}

export interface DriverProfile {
  id: string;
  user_id: string | null;
  full_name: string;
  contact_number: string;
  car_model: string;
  reg_number: string;
  is_active: boolean;
}

export interface DeliveryProof {
  id: string;
  order_id: string;
  driver_id: string | null;
  proof_url: string;
  notes: string;
  delivered_at: string;
}

export const DRIVER_SHARE_PERCENT = 0.7;

interface DriverTripRow {
  id: string;
  order_id: string;
  date: string;
  location: string;
  status: string;
  distance_km: number | null;
  delivery_fee: number | null;
  total: number | null;
}

const mapTrip = (trip: DriverTripRow): DriverTrip => ({
  id: trip.id,
  order_id: trip.order_id,
  date: trip.date,
  location: trip.location,
  status: trip.status,
  distance_km: Number(trip.distance_km ?? 0),
  delivery_fee: Number(trip.delivery_fee ?? 0),
  total: Number(trip.total ?? 0),
});

export async function fetchDriverTrips(driverId: string): Promise<DriverTrip[]> {
  const { data, error } = await supabase
    .from('Orders')
    .select('id, order_id, date, location, status, distance_km, delivery_fee, total')
    .eq('driver_id', driverId)
    .order('date', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DriverTripRow[]).map(mapTrip);
}

export async function fetchDriverTripsForTesting(): Promise<DriverTrip[]> {
  const { data, error } = await supabase
    .from('Orders')
    .select('id, order_id, date, location, status, distance_km, delivery_fee, total')
    .neq('status', ORDER_STATUS.CREATED)
    .order('date', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DriverTripRow[]).map(mapTrip);
}

export async function fetchAvailableOrders(driverId?: string): Promise<DriverTrip[]> {
  let query = supabase
    .from('Orders')
    .select('id, order_id, date, location, status, distance_km, delivery_fee, total, driver_id')
    .eq('status', ORDER_STATUS.CREATED)
    .order('date', { ascending: false })
    .limit(50);

  if (driverId) {
    query = query.or(`driver_id.is.null,driver_id.eq.${driverId}`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DriverTripRow[]).map(mapTrip);
}

export async function acceptDriverOrder(orderDbId: string, driverId?: string): Promise<void> {
  const payload: Record<string, unknown> = {
    status: ORDER_STATUS.ACKNOWLEDGED,
  };

  if (driverId) {
    payload.driver_id = driverId;
  }

  const { error } = await supabase
    .from('Orders')
    .update(payload)
    .eq('id', orderDbId)
    .eq('status', ORDER_STATUS.CREATED);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateDriverOrderStatus(
  orderDbId: string,
  fromStatus: typeof ORDER_STATUS.ACKNOWLEDGED | typeof ORDER_STATUS.PROCESSING,
  toStatus: typeof ORDER_STATUS.PROCESSING | typeof ORDER_STATUS.COMPLETED,
  driverId?: string
): Promise<void> {
  const query = supabase
    .from('Orders')
    .update({ status: toStatus })
    .eq('id', orderDbId)
    .eq('status', fromStatus);

  if (driverId) {
    query.eq('driver_id', driverId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadDeliveryProof(file: File, orderRef: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `orders/${orderRef}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('delivery-proofs')
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Proof upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('delivery-proofs').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function saveDeliveryProof(
  orderDbId: string,
  proofUrl: string,
  notes: string,
  driverId?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    order_id: orderDbId,
    proof_url: proofUrl,
    notes,
    delivered_at: new Date().toISOString(),
  };

  if (driverId) {
    payload.driver_id = driverId;
  }

  const { error } = await supabase.from('DeliveryProofs').insert([payload]);
  if (error) {
    throw new Error(
      `Saving delivery proof failed: ${error.message}. Ensure DeliveryProofs table exists.`
    );
  }
}

export function computeDriverStats(trips: DriverTrip[]): DriverStats {
  const completedTrips = trips.filter((trip) => trip.status === ORDER_STATUS.COMPLETED).length;
  const totalDistanceKm = trips.reduce((sum, trip) => sum + trip.distance_km, 0);
  const totalDriverEarnings = trips.reduce(
    (sum, trip) => sum + trip.delivery_fee * DRIVER_SHARE_PERCENT,
    0
  );

  return {
    totalTrips: trips.length,
    completedTrips,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalDriverEarnings: Number(totalDriverEarnings.toFixed(2)),
  };
}

export async function fetchDriverProfileByUserId(userId: string): Promise<DriverProfile | null> {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('id, user_id, full_name, contact_number, car_model, reg_number, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    const message = error.message || '';
    if (message.includes('Could not find the table') || message.includes('does not exist')) {
      return null;
    }
    throw new Error(error.message);
  }

  return (data as DriverProfile | null) ?? null;
}

export function buildDriverNavigationUrl(destination: string): string {
  const encodedDestination = encodeURIComponent(destination.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`;
}

export function openDriverNavigation(destination: string): boolean {
  const cleanDestination = destination.trim();
  if (!cleanDestination) return false;
  const url = buildDriverNavigationUrl(cleanDestination);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(opened);
}

export async function fetchFirstDriverProfileForTesting(): Promise<DriverProfile | null> {
  const { data, error } = await supabase
    .from('driver_profiles')
    .select('id, user_id, full_name, contact_number, car_model, reg_number, is_active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    const message = error.message || '';
    if (message.includes('Could not find the table') || message.includes('does not exist')) {
      return null;
    }
    throw new Error(error.message);
  }

  return (data as DriverProfile | null) ?? null;
}
