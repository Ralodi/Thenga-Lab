import { Product } from "@/data/products";
import { supabase } from "@/lib/supabaseClient";

export const fetchProducts = async (): Promise<Product[]> => {
    const { data, error} = await supabase
      .from('Products')
        .select(`
            id,
            name,
            description,
            image,            
            price,
            stock,
            unit,
            created_at,
            ProductType (
                name
            )
            `)
        .eq('isactive', true)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Error fetching products: ${error.message}`);
    }
    return data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        image: item.image,
        price: item.price,
        stock: item.stock,
        unit: item.unit,
        type: item?.ProductType?.name.toLowerCase() || 'unknown', // Map ProductType name to type
    })) as Product[];
};