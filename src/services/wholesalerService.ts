import { supabase } from '@/lib/supabaseClient';

export interface Wholesaler {
  id: string;
  name: string;
  area: string;
  city: string;
}

export const fetchWholesalers = async (): Promise<Wholesaler[]> => {
  const { data, error } = await supabase
    .from('wholesalers')
    .select('id, name, area, city')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Error fetching wholesalers: ${error.message}`);
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    area: item.area,
    city: item.city,
  }));
};
