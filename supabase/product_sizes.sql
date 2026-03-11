-- Brand/family-level size options and order-item size capture.
-- Additive and backward-compatible.

alter table if exists public.product_families
  add column if not exists available_sizes text[] not null default '{}'::text[];

alter table if exists public."OrderItems"
  add column if not exists selected_size text;

create index if not exists idx_product_families_available_sizes
  on public.product_families using gin (available_sizes);

create or replace view public.vw_catalog_products_phase1 as
select
  p.id as product_id,
  p.name as product_name,
  p.description as product_description,
  p.image as product_image,
  p.price as product_price,
  p.stock as product_stock,
  p.unit as product_unit,
  p.isactive as product_is_active,
  p.wholesaler_id,
  p.product_type_id,
  pf.id as product_family_id,
  pf.brand_name,
  pf.family_name,
  pf.available_sizes,
  pc.id as category_id,
  pc.slug as category_slug,
  pc.name as category_name,
  pv.id as product_variant_id,
  pv.variant_name,
  pv.sku,
  pv.volume_ml,
  pv.quantity_per_pack,
  pv.unit_label,
  pt.code as packaging_code,
  pt.name as packaging_name
from public."Products" p
left join public.product_variants pv on pv.product_id = p.id
left join public.product_families pf on pf.id = pv.family_id
left join public.product_categories pc on pc.id = pf.category_id
left join public.packaging_types pt on pt.id = pv.packaging_type_id;
