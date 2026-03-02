import { Address } from "@/data/address";
import { Product } from "@/data/products";
import { supabase } from "@/lib/supabaseClient";

export const fetchAddressesByUserId = async (userId: string): Promise<Address[]> => {
    const { data, error } = await supabase
        .from('addresses')
        .select(`
            id,
            street,
            city,
            postal_code
            `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Error fetching products: ${error.message}`);
    }
    return data.map(item => ({
        id: item.id,
        street: item.street,
        city: item.city,
        postal_code: item.postal_code
    })) as Address[];
};