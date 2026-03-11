import { supabase } from '@/lib/supabaseClient';

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  bg_color: string;
  text_color: string;
  cta_text: string;
  cta_link: string;
  bonus_points: number;
  min_order_total: number | null;
  campaign_priority: number;
  is_stackable: boolean;
  area: string | null;
  wholesaler_id: string | null;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
}

export interface OfferUpsertInput {
  id?: string;
  title: string;
  subtitle: string;
  image_url: string;
  bg_color: string;
  text_color: string;
  cta_text: string;
  cta_link: string;
  bonus_points: number;
  min_order_total: number | null;
  campaign_priority: number;
  is_stackable: boolean;
  area: string | null;
  wholesaler_id: string | null;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
}

const mapOffer = (item: any): Offer => ({
  id: String(item.id),
  title: String(item.title ?? ''),
  subtitle: String(item.subtitle ?? ''),
  image_url: String(item.image_url ?? ''),
  bg_color: String(item.bg_color ?? '#0f3b74'),
  text_color: String(item.text_color ?? '#ffffff'),
  cta_text: String(item.cta_text ?? ''),
  cta_link: String(item.cta_link ?? ''),
  bonus_points: Number(item.bonus_points ?? 0),
  min_order_total: item.min_order_total === null || item.min_order_total === undefined
    ? null
    : Number(item.min_order_total),
  campaign_priority: Number(item.campaign_priority ?? 100),
  is_stackable: Boolean(item.is_stackable),
  area: item.area ? String(item.area) : null,
  wholesaler_id: item.wholesaler_id ? String(item.wholesaler_id) : null,
  is_active: Boolean(item.is_active),
  start_at: item.start_at ? String(item.start_at) : null,
  end_at: item.end_at ? String(item.end_at) : null,
});

const isOfferWithinTimeWindow = (offer: Offer) => {
  const now = Date.now();
  if (offer.start_at && new Date(offer.start_at).getTime() > now) return false;
  if (offer.end_at && new Date(offer.end_at).getTime() < now) return false;
  return true;
};

export async function fetchAllOffers(): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    const message = error.message || '';
    if (message.includes('Could not find the table') || message.includes('does not exist')) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []).map(mapOffer);
}

export async function fetchActiveOffersForCustomer(
  area?: string,
  wholesalerId?: string
): Promise<Offer[]> {
  const allOffers = await fetchAllOffers();

  return allOffers.filter((offer) => {
    if (!offer.is_active) return false;
    if (!isOfferWithinTimeWindow(offer)) return false;

    const areaMatch = !offer.area || !area || offer.area.toLowerCase() === area.toLowerCase();
    const wholesalerMatch =
      !offer.wholesaler_id || !wholesalerId || offer.wholesaler_id === wholesalerId;

    return areaMatch && wholesalerMatch;
  });
}

export async function upsertOffer(input: OfferUpsertInput): Promise<void> {
  const payload = {
    title: input.title,
    subtitle: input.subtitle,
    image_url: input.image_url,
    bg_color: input.bg_color,
    text_color: input.text_color,
    cta_text: input.cta_text,
    cta_link: input.cta_link,
    bonus_points: Math.max(0, Math.floor(Number(input.bonus_points || 0))),
    min_order_total:
      input.min_order_total === null || input.min_order_total === undefined
        ? null
        : Number(input.min_order_total),
    campaign_priority: Math.floor(Number(input.campaign_priority ?? 100)),
    is_stackable: Boolean(input.is_stackable),
    area: input.area,
    wholesaler_id: input.wholesaler_id,
    is_active: input.is_active,
    start_at: input.start_at,
    end_at: input.end_at,
  };

  if (input.id) {
    const { error } = await supabase.from('offers').update(payload).eq('id', input.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('offers').insert([payload]);
  if (error) throw new Error(error.message);
}

export async function uploadOfferImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filePath = `banners/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('offer-banners')
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw new Error(`Offer image upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('offer-banners').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function offerFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read local offer image file'));
    reader.readAsDataURL(file);
  });
}
