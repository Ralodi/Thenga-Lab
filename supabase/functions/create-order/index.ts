import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_FEE = 80;
const BASE_DISTANCE_KM = 2;
const EXTRA_PER_KM = 18;
const ACTIVE_TRIP_STATUSES = ["Created", "Acknowledged", "Processing"];
const LOYALTY_POINTS_TIER_ONE_MIN_TOTAL = 3000;
const LOYALTY_POINTS_TIER_TWO_MIN_TOTAL = 5000;
const LOYALTY_POINTS_TIER_ONE = 10;
const LOYALTY_POINTS_TIER_TWO = 15;
const LOYALTY_POINT_TO_RAND = 0.33;

interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  size?: string | null;
}

interface CreateOrderPayload {
  customer_name: string;
  location: string;
  contact_number: string;
  user_id?: string | null;
  address_id?: string | null;
  distance_km: number;
  points_to_redeem?: number;
  items: CreateOrderItemInput[];
}

interface DriverProfileRow {
  user_id: string | null;
  area?: string | null;
  city?: string | null;
}

interface OfferCampaignRow {
  id: string;
  bonus_points: number | null;
  min_order_total: number | null;
  campaign_priority: number | null;
  is_stackable: boolean | null;
  area: string | null;
  wholesaler_id: string | null;
  start_at: string | null;
  end_at: string | null;
  created_at: string | null;
}

interface LoyaltyAwardResult {
  earned: number;
  base_earned: number;
  bonus_earned: number;
  total: number | null;
  redeemed: number;
  redemption_value: number;
}

const isUuid = (value?: string | null) =>
  Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );

const calculateDeliveryFee = (distanceKm: number) => {
  const safeDistance = Math.max(0, distanceKm);
  if (safeDistance <= BASE_DISTANCE_KM) return BASE_FEE;
  return BASE_FEE + (safeDistance - BASE_DISTANCE_KM) * EXTRA_PER_KM;
};

const calculateLoyaltyPoints = (orderTotal: number) => {
  if (orderTotal > LOYALTY_POINTS_TIER_TWO_MIN_TOTAL) return LOYALTY_POINTS_TIER_TWO;
  if (orderTotal > LOYALTY_POINTS_TIER_ONE_MIN_TOTAL) return LOYALTY_POINTS_TIER_ONE;
  return 0;
};
const roundMoney = (value: number) => Math.round(value * 100) / 100;

const deriveBaseCost = (
  unitPrice: number,
  baseCostRaw: unknown,
  marginTypeRaw: unknown,
  marginValueRaw: unknown
) => {
  const configuredBase = Number(baseCostRaw);
  if (Number.isFinite(configuredBase) && configuredBase >= 0) {
    return roundMoney(configuredBase);
  }

  const marginType = String(marginTypeRaw ?? "fixed").toLowerCase();
  const marginValue = Math.max(0, Number(marginValueRaw ?? 0));

  if (marginType === "percent" && marginValue > 0) {
    const base = unitPrice / (1 + marginValue / 100);
    return roundMoney(Math.max(0, base));
  }

  if (marginType === "fixed" && marginValue > 0) {
    return roundMoney(Math.max(0, unitPrice - marginValue));
  }

  return roundMoney(Math.max(0, unitPrice));
};

const normalizeText = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const buildLoyaltyKey = (userId: string | null, contactNumber: string, customerName: string) => {
  if (userId) return `user:${userId}`;

  const safeContact = normalizeText(contactNumber).replace(/\s+/g, "");
  const safeName = normalizeText(customerName).replace(/\s+/g, " ");
  return `guest:${safeContact}|${safeName}`;
};

const extractCityFromAddress = (location: string): string | null => {
  const parts = String(location)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[1];
  if (parts.length === 1) return parts[0];
  return null;
};

const resolveAutoAssignedDriverId = async (
  supabase: ReturnType<typeof createClient>,
  destinationLocation: string
): Promise<string | null> => {
  let drivers: DriverProfileRow[] | null = null;

  const { data: driversWithArea, error: driversWithAreaError } = await supabase
    .from("driver_profiles")
    .select("user_id, area, city")
    .eq("is_active", true)
    .not("user_id", "is", null);

  if (driversWithAreaError) {
    const msg = driversWithAreaError.message ?? "";
    if (msg.includes("Could not find the table") || msg.includes("does not exist")) {
      return null;
    }

    if (msg.includes("column") && (msg.includes("area") || msg.includes("city"))) {
      const { data: fallbackDrivers, error: fallbackError } = await supabase
        .from("driver_profiles")
        .select("user_id")
        .eq("is_active", true)
        .not("user_id", "is", null);

      if (fallbackError) {
        throw new Error(`Failed loading drivers: ${fallbackError.message}`);
      }
      drivers = (fallbackDrivers ?? []) as DriverProfileRow[];
    } else {
      throw new Error(`Failed loading drivers: ${driversWithAreaError.message}`);
    }
  } else {
    drivers = (driversWithArea ?? []) as DriverProfileRow[];
  }

  const eligibleDriverIds = (drivers ?? [])
    .map((driver: DriverProfileRow) => driver.user_id)
    .filter((id): id is string => Boolean(id));

  if (eligibleDriverIds.length === 0) {
    return null;
  }

  const destinationCity = normalizeText(extractCityFromAddress(destinationLocation));
  let scopedDriverIds = eligibleDriverIds;

  if (destinationCity) {
    const localDriverIds = (drivers ?? [])
      .filter((driver) => {
        const city = normalizeText(driver.city);
        const area = normalizeText(driver.area);
        return city === destinationCity || area === destinationCity;
      })
      .map((driver) => driver.user_id)
      .filter((id): id is string => Boolean(id));

    if (localDriverIds.length > 0) {
      scopedDriverIds = localDriverIds;
    }
  }

  const { data: openOrders, error: ordersError } = await supabase
    .from("Orders")
    .select("driver_id")
    .in("status", ACTIVE_TRIP_STATUSES)
    .in("driver_id", scopedDriverIds);

  if (ordersError) {
    throw new Error(`Failed loading driver workloads: ${ordersError.message}`);
  }

  const loadByDriver = new Map<string, number>();
  scopedDriverIds.forEach((id) => loadByDriver.set(id, 0));

  for (const order of openOrders ?? []) {
    const driverId = String((order as { driver_id?: string | null }).driver_id ?? "");
    if (!driverId) continue;
    loadByDriver.set(driverId, (loadByDriver.get(driverId) ?? 0) + 1);
  }

  const sorted = [...scopedDriverIds].sort((a, b) => {
    const aLoad = loadByDriver.get(a) ?? 0;
    const bLoad = loadByDriver.get(b) ?? 0;
    if (aLoad !== bLoad) return aLoad - bLoad;
    return a.localeCompare(b);
  });

  return sorted[0] ?? null;
};

const getCustomerLoyaltyTotal = async (
  supabase: ReturnType<typeof createClient>,
  loyaltyKey: string
): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from("customer_loyalty")
      .select("total_points")
      .eq("loyalty_key", loyaltyKey)
      .maybeSingle();

    if (error) throw error;
    return Number(data?.total_points ?? 0);
  } catch (error) {
    const msg = String((error as { message?: string })?.message ?? "");
    if (msg.includes("Could not find the table") || msg.includes("does not exist")) {
      return 0;
    }
    throw error;
  }
};

const resolveOfferBonusPoints = async (
  supabase: ReturnType<typeof createClient>,
  input: {
    orderTotal: number;
    destinationLocation: string;
    wholesalerId: string | null;
  }
): Promise<number> => {
  try {
    let data: OfferCampaignRow[] | null = null;
    let error: { message?: string } | null = null;

    const { data: fullData, error: fullError } = await supabase
      .from("offers")
      .select(
        "id, bonus_points, min_order_total, campaign_priority, is_stackable, area, wholesaler_id, start_at, end_at, created_at, is_active"
      )
      .eq("is_active", true);

    if (fullError) {
      const msg = fullError.message ?? "";
      if (msg.includes("column") && (msg.includes("campaign_priority") || msg.includes("is_stackable"))) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("offers")
          .select("id, bonus_points, min_order_total, area, wholesaler_id, start_at, end_at, created_at, is_active")
          .eq("is_active", true);
        data = (fallbackData ?? []) as OfferCampaignRow[];
        error = fallbackError ? { message: fallbackError.message } : null;
      } else {
        data = null;
        error = { message: msg };
      }
    } else {
      data = (fullData ?? []) as OfferCampaignRow[];
      error = null;
    }

    if (error) throw error;

    const now = Date.now();
    const destinationArea = normalizeText(extractCityFromAddress(input.destinationLocation));
    const rows = (data ?? []) as OfferCampaignRow[];
    const eligibleOffers: Array<{
      bonus: number;
      priority: number;
      stackable: boolean;
      createdAt: number;
    }> = [];

    for (const offer of rows) {
      const bonus = Math.max(0, Math.floor(Number(offer.bonus_points ?? 0)));
      if (bonus <= 0) continue;

      const startsAt = offer.start_at ? new Date(offer.start_at).getTime() : null;
      const endsAt = offer.end_at ? new Date(offer.end_at).getTime() : null;
      if (startsAt && startsAt > now) continue;
      if (endsAt && endsAt < now) continue;

      const minTotal = offer.min_order_total === null || offer.min_order_total === undefined
        ? null
        : Number(offer.min_order_total);
      if (minTotal !== null && input.orderTotal < minTotal) continue;

      const offerArea = normalizeText(offer.area);
      if (offerArea && destinationArea && offerArea !== destinationArea) continue;
      if (offerArea && !destinationArea) continue;

      if (offer.wholesaler_id && input.wholesalerId && offer.wholesaler_id !== input.wholesalerId) continue;
      if (offer.wholesaler_id && !input.wholesalerId) continue;

      eligibleOffers.push({
        bonus,
        priority: Math.max(0, Math.floor(Number(offer.campaign_priority ?? 100))),
        stackable: Boolean(offer.is_stackable),
        createdAt: offer.created_at ? new Date(offer.created_at).getTime() : 0,
      });
    }

    if (eligibleOffers.length === 0) return 0;

    eligibleOffers.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.createdAt - a.createdAt;
    });

    let exclusiveBonus = 0;
    let stackedBonus = 0;

    for (const offer of eligibleOffers) {
      if (offer.stackable) {
        stackedBonus += offer.bonus;
        continue;
      }

      if (exclusiveBonus === 0) {
        exclusiveBonus = offer.bonus;
      }
    }

    return Math.max(stackedBonus, exclusiveBonus);
  } catch (error) {
    const msg = String((error as { message?: string })?.message ?? "");
    if (msg.includes("Could not find the table") || msg.includes("does not exist")) {
      return 0;
    }
    throw error;
  }
};

const awardLoyaltyPoints = async (
  supabase: ReturnType<typeof createClient>,
  input: {
    orderDbId: string;
    orderId: string;
    orderTotal: number;
    bonusPoints: number;
    pointsToRedeem: number;
    pointToRandRate: number;
    userId: string | null;
    customerName: string;
    contactNumber: string;
  }
): Promise<LoyaltyAwardResult> => {
  const loyaltyKey = buildLoyaltyKey(input.userId, input.contactNumber, input.customerName);
  const baseEarned = calculateLoyaltyPoints(input.orderTotal);
  const bonusEarned = Math.max(0, Math.floor(Number(input.bonusPoints || 0)));
  const earned = baseEarned + bonusEarned;
  const requestedRedeemed = Math.max(0, Math.floor(Number(input.pointsToRedeem || 0)));

  try {
    const { data: currentRow, error: currentError } = await supabase
      .from("customer_loyalty")
      .select("total_points")
      .eq("loyalty_key", loyaltyKey)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    const currentTotal = Number(currentRow?.total_points ?? 0);
    const redeemed = Math.min(requestedRedeemed, currentTotal);
    const redemptionValue = roundMoney(redeemed * input.pointToRandRate);
    const nextTotal = Math.max(0, currentTotal - redeemed + earned);

    const { error: upsertError } = await supabase.from("customer_loyalty").upsert(
      [
        {
          loyalty_key: loyaltyKey,
          user_id: input.userId,
          customer_name: input.customerName,
          contact_number: input.contactNumber,
          total_points: nextTotal,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "loyalty_key" }
    );

    if (upsertError) {
      throw upsertError;
    }

    if (earned > 0 || redeemed > 0) {
      const { error: ledgerError } = await supabase.from("loyalty_points_ledger").upsert(
        [
          {
            order_db_id: input.orderDbId,
            order_id: input.orderId,
            loyalty_key: loyaltyKey,
            user_id: input.userId,
            points_earned_base: baseEarned,
            points_earned_bonus: bonusEarned,
            points_earned: earned,
            points_redeemed: redeemed,
            redemption_value: redemptionValue,
            order_total: input.orderTotal,
          },
        ],
        { onConflict: "order_db_id" }
      );

      if (ledgerError) {
        throw ledgerError;
      }
    }

    return {
      earned,
      base_earned: baseEarned,
      bonus_earned: bonusEarned,
      total: nextTotal,
      redeemed,
      redemption_value: redemptionValue,
    };
  } catch (error) {
    console.error("Loyalty award skipped:", error);
    return { earned: 0, base_earned: 0, bonus_earned: 0, total: null, redeemed: 0, redemption_value: 0 };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server is not configured correctly" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const payload = (await req.json()) as CreateOrderPayload;
    const authorization = req.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

    let requesterUserId: string | null = null;
    if (token && anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      const { data: authData } = await authClient.auth.getUser();
      requesterUserId = authData?.user?.id ?? null;
    }

    const customerName = String(payload.customer_name ?? "").trim();
    const location = String(payload.location ?? "").trim();
    const contactNumber = String(payload.contact_number ?? "").trim();
    const distanceKm = Number(payload.distance_km);
    const requestedPointsToRedeem = Math.max(0, Math.floor(Number(payload.points_to_redeem ?? 0)));
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!customerName || !location || !contactNumber) {
      return new Response(JSON.stringify({ error: "Missing customer details" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      return new Response(JSON.stringify({ error: "Invalid distance_km" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "Order must contain at least one item" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const item of items) {
      if (!item?.product_id || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        return new Response(JSON.stringify({ error: "Invalid item payload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const productIds = [...new Set(items.map((item) => item.product_id))];

    const { data: products, error: productsError } = await supabase
      .from("Products")
      .select("id, name, description, image, price, base_cost, margin_type, margin_value, unit, isactive, wholesaler_id, product_type_id, ProductType(name)")
      .in("id", productIds);

    if (productsError) {
      return new Response(JSON.stringify({ error: productsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productMap = new Map<string, any>();
    for (const product of products ?? []) {
      if (product.isactive) {
        productMap.set(product.id, product);
      }
    }

    const normalizedItems = items.map((item) => {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error(`Product unavailable: ${item.product_id}`);
      }

      const unitPrice = Number(product.price ?? 0);
      const quantity = Number(item.quantity);
      const marginType = String(product.margin_type ?? "fixed").toLowerCase() === "percent" ? "percent" : "fixed";
      const marginValue = Math.max(0, Number(product.margin_value ?? 0));
      const baseCost = deriveBaseCost(unitPrice, product.base_cost, marginType, marginValue);
      const lineTotal = roundMoney(unitPrice * quantity);
      const wholesalerPayout = roundMoney(baseCost * quantity);
      const marginAmount = roundMoney(Math.max(0, lineTotal - wholesalerPayout));
      const selectedSize = String(item.size ?? "").trim();

      return {
        product_id: product.id,
        name: String(product.name ?? ""),
        description: String(product.description ?? ""),
        image: String(product.image ?? ""),
        price: unitPrice,
        unit: String(product.unit ?? "case"),
        type: String(product?.ProductType?.name ?? "unknown").toLowerCase(),
        wholesaler_id: product.wholesaler_id ? String(product.wholesaler_id) : null,
        base_cost_snapshot: baseCost,
        margin_type_snapshot: marginType,
        margin_value_snapshot: marginValue,
        margin_amount_snapshot: marginAmount,
        wholesaler_payout_snapshot: wholesalerPayout,
        selected_size: selectedSize.length > 0 ? selectedSize : null,
        quantity,
        line_total: lineTotal,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.line_total, 0);
    const deliveryFee = calculateDeliveryFee(distanceKm);
    const preRedemptionTotal = roundMoney(subtotal + deliveryFee);
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const nowIso = new Date().toISOString();

    const safeUserId = isUuid(payload.user_id) ? payload.user_id : null;
    const safeAddressId = isUuid(payload.address_id) ? payload.address_id : null;

    if (safeUserId && requesterUserId && safeUserId !== requesterUserId) {
      return new Response(JSON.stringify({ error: "user_id does not match authenticated user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedUserId = requesterUserId ?? safeUserId;
    const loyaltyKey = buildLoyaltyKey(resolvedUserId, contactNumber, customerName);
    const loyaltyBalance = await getCustomerLoyaltyTotal(supabase, loyaltyKey);
    const maxRedeemableByTotal = Math.floor(preRedemptionTotal / LOYALTY_POINT_TO_RAND);
    const pointsToRedeem = Math.min(requestedPointsToRedeem, loyaltyBalance, maxRedeemableByTotal);
    const redemptionValue = roundMoney(pointsToRedeem * LOYALTY_POINT_TO_RAND);
    const total = roundMoney(preRedemptionTotal - redemptionValue);
    const firstProduct = products?.[0] as { wholesaler_id?: string | null } | undefined;
    const bonusOfferPoints = await resolveOfferBonusPoints(supabase, {
      orderTotal: total,
      destinationLocation: location,
      wholesalerId: firstProduct?.wholesaler_id ?? null,
    });

    const autoAssignedDriverId = await resolveAutoAssignedDriverId(supabase, location);

    const { data: insertedOrder, error: orderError } = await supabase
      .from("Orders")
      .insert([
        {
          order_id: orderId,
          customer_name: customerName,
          location,
          contact_number: contactNumber,
          subtotal,
          delivery_fee: deliveryFee,
          distance_km: distanceKm,
          total,
          loyalty_points_redeemed: pointsToRedeem,
          loyalty_redemption_value: redemptionValue,
          date: nowIso,
          user_id: resolvedUserId,
          address_id: safeAddressId,
          driver_id: autoAssignedDriverId,
          status: "Created",
        },
      ])
      .select("id, order_id, subtotal, delivery_fee, distance_km, total, date, status, driver_id")
      .single();

    if (orderError || !insertedOrder) {
      return new Response(JSON.stringify({ error: orderError?.message ?? "Order insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderItemsPayload = normalizedItems.map((item) => ({
      order_id: insertedOrder.id,
      product_id: item.product_id,
      name: item.name,
      description: item.description,
      image: item.image,
      price: item.price,
      unit: item.unit,
      type: item.type,
      quantity: item.quantity,
      wholesaler_id: item.wholesaler_id,
      base_cost_snapshot: item.base_cost_snapshot,
      margin_type_snapshot: item.margin_type_snapshot,
      margin_value_snapshot: item.margin_value_snapshot,
      margin_amount_snapshot: item.margin_amount_snapshot,
      wholesaler_payout_snapshot: item.wholesaler_payout_snapshot,
      selected_size: item.selected_size,
    }));

    let itemsInsertError: { message?: string } | null = null;
    const { error: itemsError } = await supabase.from("OrderItems").insert(orderItemsPayload);
    if (itemsError) {
      const msg = itemsError.message ?? "";
      if (
        msg.includes("column") &&
        (
          msg.includes("wholesaler_id") ||
          msg.includes("base_cost_snapshot") ||
          msg.includes("margin_type_snapshot") ||
          msg.includes("margin_value_snapshot") ||
          msg.includes("margin_amount_snapshot") ||
          msg.includes("wholesaler_payout_snapshot") ||
          msg.includes("selected_size")
        )
      ) {
        const fallbackPayload = normalizedItems.map((item) => ({
          order_id: insertedOrder.id,
          product_id: item.product_id,
          name: item.name,
          description: item.description,
          image: item.image,
          price: item.price,
          unit: item.unit,
          type: item.type,
          quantity: item.quantity,
        }));
        const { error: fallbackItemsError } = await supabase.from("OrderItems").insert(fallbackPayload);
        itemsInsertError = fallbackItemsError ? { message: fallbackItemsError.message } : null;
      } else {
        itemsInsertError = { message: msg };
      }
    }

    if (itemsInsertError) {
      await supabase.from("Orders").delete().eq("id", insertedOrder.id);

      return new Response(JSON.stringify({ error: itemsInsertError.message ?? "Order items insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loyalty = await awardLoyaltyPoints(supabase, {
      orderDbId: String(insertedOrder.id),
      orderId: String(insertedOrder.order_id),
      orderTotal: total,
      bonusPoints: bonusOfferPoints,
      pointsToRedeem,
      pointToRandRate: LOYALTY_POINT_TO_RAND,
      userId: resolvedUserId,
      customerName,
      contactNumber,
    });

    return new Response(
      JSON.stringify({
        order: insertedOrder,
        loyalty,
        items: normalizedItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
          size: item.selected_size,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
