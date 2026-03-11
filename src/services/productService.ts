import { Product } from "@/data/products";
import { supabase } from "@/lib/supabaseClient";

const PLACEHOLDER_IMAGE = '/products/placeholder.svg';

const normalizeImagePath = (image?: string | null): string => {
  if (!image || image.trim().length === 0) {
    return PLACEHOLDER_IMAGE;
  }

  const trimmed = image.trim();

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/public/')) {
    return trimmed.replace('/public', '');
  }

  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }

  return trimmed;
};

const mapProduct = (item: any): Product => ({
  id: item.id,
  name: item.name,
  description: item.description,
  image: normalizeImagePath(item.image),
  price: item.price,
  stock: item.stock,
  unit: item.unit,
  type: item?.ProductType?.name?.toLowerCase() || 'unknown',
});

const resolveTypeFromCategory = (categorySlug?: string | null, categoryName?: string | null): string => {
  const slug = String(categorySlug ?? '').toLowerCase();
  const name = String(categoryName ?? '').toLowerCase();

  if (slug.startsWith('beer') || name.includes('beer')) return 'beer';
  if (slug.startsWith('spirit') || slug === 'spirits' || name.includes('spirit')) return 'spirits';
  if (slug.startsWith('mixer') || name.includes('mixer')) return 'mixers';
  if (slug.startsWith('extra') || name.includes('extra')) return 'extras';
  if (name.includes('cider')) return 'cider';
  return 'unknown';
};

const mapCatalogProduct = (item: any): Product => ({
  id: String(item.product_id),
  name: String(item.product_name ?? ''),
  description: String(item.product_description ?? ''),
  image: normalizeImagePath(item.product_image),
  price: Number(item.product_price ?? 0),
  stock: Number(item.product_stock ?? 0),
  unit: String(item.product_unit ?? 'case'),
  type: resolveTypeFromCategory(item.category_slug, item.category_name),
  category_slug: item.category_slug ? String(item.category_slug) : undefined,
  category_name: item.category_name ? String(item.category_name) : undefined,
  variant_name: item.variant_name ? String(item.variant_name) : undefined,
  packaging_code: item.packaging_code ? String(item.packaging_code) : undefined,
  packaging_name: item.packaging_name ? String(item.packaging_name) : undefined,
  volume_ml:
    item.volume_ml === null || item.volume_ml === undefined
      ? null
      : Number(item.volume_ml),
  family_name: item.family_name ? String(item.family_name) : undefined,
  brand_name: item.brand_name ? String(item.brand_name) : undefined,
  available_sizes: Array.isArray(item.available_sizes)
    ? item.available_sizes
        .map((size: unknown) => String(size ?? '').trim())
        .filter((size: string) => size.length > 0)
    : undefined,
});

const fetchAvailableSizesByProductIds = async (productIds: string[]): Promise<Map<string, string[]>> => {
  const result = new Map<string, string[]>();
  if (productIds.length === 0) return result;

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('product_id, family_id')
    .in('product_id', productIds);

  if (variantsError) {
    return result;
  }

  const familyIdByProductId = new Map<string, string>();
  const familyIds = new Set<string>();
  for (const row of variants ?? []) {
    const productId = String((row as any).product_id ?? '').trim();
    const familyId = String((row as any).family_id ?? '').trim();
    if (!productId || !familyId) continue;
    familyIdByProductId.set(productId, familyId);
    familyIds.add(familyId);
  }

  if (familyIds.size === 0) return result;

  const { data: families, error: familiesError } = await supabase
    .from('product_families')
    .select('id, available_sizes')
    .in('id', Array.from(familyIds));

  if (familiesError) {
    return result;
  }

  const sizesByFamilyId = new Map<string, string[]>();
  for (const row of families ?? []) {
    const familyId = String((row as any).id ?? '').trim();
    if (!familyId) continue;
    const sizes = Array.isArray((row as any).available_sizes)
      ? (row as any).available_sizes
          .map((size: unknown) => String(size ?? '').trim())
          .filter((size: string) => size.length > 0)
      : [];
    sizesByFamilyId.set(familyId, sizes);
  }

  for (const productId of productIds) {
    const familyId = familyIdByProductId.get(productId);
    if (!familyId) continue;
    const sizes = sizesByFamilyId.get(familyId) ?? [];
    if (sizes.length > 0) result.set(productId, sizes);
  }

  return result;
};

const enrichProductsWithAvailableSizes = async (products: Product[]): Promise<Product[]> => {
  const ids = products.map((item) => String(item.id)).filter(Boolean);
  const sizesByProductId = await fetchAvailableSizesByProductIds(ids);
  if (sizesByProductId.size === 0) return products;

  return products.map((item) => {
    const sizes = sizesByProductId.get(String(item.id));
    if (!sizes || sizes.length === 0) return item;
    return { ...item, available_sizes: sizes };
  });
};

export const fetchProducts = async (): Promise<Product[]> => {
  const { data: catalogData, error: catalogError } = await supabase
    .from('vw_catalog_products_phase1')
    .select(`
      product_id,
      product_name,
      product_description,
      product_image,
      product_price,
      product_stock,
      product_unit,
      product_is_active,
      category_slug,
      category_name,
      variant_name,
      packaging_code,
      packaging_name,
      volume_ml,
      family_name,
      brand_name,
      available_sizes
    `)
    .eq('product_is_active', true)
    .order('product_name', { ascending: true });

  if (!catalogError) {
    const mapped = (catalogData ?? []).map(mapCatalogProduct);
    return enrichProductsWithAvailableSizes(mapped);
  }

  const { data: catalogDataFallback, error: catalogFallbackError } = await supabase
    .from('vw_catalog_products_phase1')
    .select(`
      product_id,
      product_name,
      product_description,
      product_image,
      product_price,
      product_stock,
      product_unit,
      product_is_active,
      category_slug,
      category_name,
      variant_name,
      packaging_code,
      packaging_name,
      volume_ml,
      family_name,
      brand_name
    `)
    .eq('product_is_active', true)
    .order('product_name', { ascending: true });

  if (!catalogFallbackError) {
    const mapped = (catalogDataFallback ?? []).map(mapCatalogProduct);
    return enrichProductsWithAvailableSizes(mapped);
  }

  const { data, error } = await supabase
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

  const mapped = (data ?? []).map(mapProduct);
  return enrichProductsWithAvailableSizes(mapped);
};

export const fetchProductsByWholesaler = async (wholesalerId: string): Promise<Product[]> => {
  const { data: catalogData, error: catalogError } = await supabase
    .from('vw_catalog_products_phase1')
    .select(`
      product_id,
      product_name,
      product_description,
      product_image,
      product_price,
      product_stock,
      product_unit,
      product_is_active,
      wholesaler_id,
      category_slug,
      category_name,
      variant_name,
      packaging_code,
      packaging_name,
      volume_ml,
      family_name,
      brand_name,
      available_sizes
    `)
    .eq('product_is_active', true)
    .eq('wholesaler_id', wholesalerId)
    .order('product_name', { ascending: true });

  if (!catalogError) {
    const mapped = (catalogData ?? []).map(mapCatalogProduct);
    return enrichProductsWithAvailableSizes(mapped);
  }

  const { data: catalogDataFallback, error: catalogFallbackError } = await supabase
    .from('vw_catalog_products_phase1')
    .select(`
      product_id,
      product_name,
      product_description,
      product_image,
      product_price,
      product_stock,
      product_unit,
      product_is_active,
      wholesaler_id,
      category_slug,
      category_name,
      variant_name,
      packaging_code,
      packaging_name,
      volume_ml,
      family_name,
      brand_name
    `)
    .eq('product_is_active', true)
    .eq('wholesaler_id', wholesalerId)
    .order('product_name', { ascending: true });

  if (!catalogFallbackError) {
    const mapped = (catalogDataFallback ?? []).map(mapCatalogProduct);
    return enrichProductsWithAvailableSizes(mapped);
  }

  const { data, error } = await supabase
    .from('Products')
    .select(`
      id,
      name,
      description,
      image,
      price,
      stock,
      unit,
      wholesaler_id,
      created_at,
      ProductType (
        name
      )
    `)
    .eq('isactive', true)
    .eq('wholesaler_id', wholesalerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching wholesaler products: ${error.message}`);
  }

  const mapped = (data ?? []).map(mapProduct);
  return enrichProductsWithAvailableSizes(mapped);
};
