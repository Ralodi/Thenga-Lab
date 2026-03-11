import { supabaseAnonKey, supabaseUrl } from '@/lib/supabaseClient';

const FALLBACK_DISTANCE_KM = 4;

export interface DistanceResult {
  distanceKm: number;
  source: 'google' | 'fallback';
}

interface DistancePayload {
  origin: string;
  destination: string;
}

export async function resolveDeliveryDistanceKm(payload: DistancePayload): Promise<DistanceResult> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calculate-distance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Distance function error: ${response.status}`);
    }

    const data = await response.json();
    const distanceKm = Number(data?.distanceKm);

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      throw new Error('Invalid distance value returned by function');
    }

    return {
      distanceKm,
      source: 'google',
    };
  } catch (error) {
    console.error('Distance calculation failed, falling back to default:', error);
    return {
      distanceKm: FALLBACK_DISTANCE_KM,
      source: 'fallback',
    };
  }
}
