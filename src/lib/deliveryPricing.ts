// src/lib/deliveryPricing.ts
const BASE_FEE = 80;
const BASE_DISTANCE_KM = 2;
const EXTRA_PER_KM = 18;

export function calculateDeliveryFee(distanceKm: number): number {
  const safeDistance = Math.max(0, distanceKm);
  if (safeDistance <= BASE_DISTANCE_KM) return BASE_FEE;

  const extraKm = safeDistance - BASE_DISTANCE_KM;
  return BASE_FEE + extraKm * EXTRA_PER_KM;
}
