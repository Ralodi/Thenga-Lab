-- Phase 1 foundation: business types + scalable catalog/variant schema
-- Additive only. No destructive changes.

-- 1) Standard business-type dimension (single field as requested)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_business_type_check'
  ) then
    alter table if exists public."Orders"
      add column if not exists customer_business_type text not null default 'tavern';

    alter table if exists public."Orders"
      add constraint orders_customer_business_type_check
      check (customer_business_type in ('tavern', 'bar', 'nightclub', 'event', 'liquor_store'));
  end if;
end $$;

create index if not exists idx_orders_customer_business_type
  on public."Orders"(customer_business_type);

-- Optional targeting on wholesalers for future catalog/promo segmentation
alter table if exists public.wholesalers
  add column if not exists target_business_types text[] not null
  default array['tavern', 'bar', 'nightclub', 'event', 'liquor_store']::text[];

-- 2) Packaging / container reference data
create table if not exists public.packaging_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_returnable boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.packaging_types (code, name, is_returnable)
values
  ('bottle', 'Bottle', false),
  ('can', 'Can', false),
  ('keg', 'Keg', true),
  ('pack', 'Pack', false),
  ('case', 'Case', false),
  ('crate', 'Crate', true),
  ('other', 'Other', false)
on conflict (code) do nothing;

-- 3) Product category tree
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid null references public.product_categories(id) on delete set null,
  slug text not null unique,
  name text not null,
  level smallint not null default 1,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_categories_parent
  on public.product_categories(parent_id);

-- Seed level-1 categories
insert into public.product_categories (slug, name, level, sort_order)
values
  ('beer', 'Beer', 1, 10),
  ('spirits', 'Spirits', 1, 20),
  ('mixers', 'Mixers', 1, 30),
  ('extras', 'Extras', 1, 40)
on conflict (slug) do nothing;

-- Seed key level-2 categories
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'beer-quart', 'Quart Beer', 2, 10 from public.product_categories where slug = 'beer'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'beer-can-500', '500ml Cans', 2, 20 from public.product_categories where slug = 'beer'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'beer-dumpy-330', '330ml Dumpies', 2, 30 from public.product_categories where slug = 'beer'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'beer-keg', 'Tap Beer (Kegs)', 2, 40 from public.product_categories where slug = 'beer'
on conflict (slug) do nothing;

insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'spirit-whisky', 'Whisky', 2, 10 from public.product_categories where slug = 'spirits'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'spirit-vodka', 'Vodka', 2, 20 from public.product_categories where slug = 'spirits'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'spirit-gin', 'Gin', 2, 30 from public.product_categories where slug = 'spirits'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'spirit-brandy', 'Brandy', 2, 40 from public.product_categories where slug = 'spirits'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'spirit-tequila', 'Tequila', 2, 50 from public.product_categories where slug = 'spirits'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'spirit-rum', 'Rum', 2, 60 from public.product_categories where slug = 'spirits'
on conflict (slug) do nothing;

insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'mixer-coke', 'Coke', 2, 10 from public.product_categories where slug = 'mixers'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'mixer-tonic', 'Tonic', 2, 20 from public.product_categories where slug = 'mixers'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'mixer-soda', 'Soda', 2, 30 from public.product_categories where slug = 'mixers'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'mixer-energy', 'Energy Drinks', 2, 40 from public.product_categories where slug = 'mixers'
on conflict (slug) do nothing;

insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'extra-ice', 'Ice', 2, 10 from public.product_categories where slug = 'extras'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'extra-ice-packs', 'Ice Packs', 2, 20 from public.product_categories where slug = 'extras'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'extra-toilet-paper', 'Toilet Paper', 2, 30 from public.product_categories where slug = 'extras'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'extra-cleaning', 'Cleaning Supplies', 2, 40 from public.product_categories where slug = 'extras'
on conflict (slug) do nothing;
insert into public.product_categories (parent_id, slug, name, level, sort_order)
select id, 'extra-consumables', 'Event Consumables', 2, 50 from public.product_categories where slug = 'extras'
on conflict (slug) do nothing;

-- 4) Product family + variant model (compatible with existing Products table)
create table if not exists public.product_families (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null default '',
  family_name text not null,
  category_id uuid null references public.product_categories(id) on delete set null,
  product_type_id uuid null references public."ProductType"(id) on delete set null,
  description text not null default '',
  image text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (brand_name, family_name)
);

create index if not exists idx_product_families_category
  on public.product_families(category_id);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.product_families(id) on delete cascade,
  product_id uuid null unique references public."Products"(id) on delete set null,
  variant_name text not null default '',
  sku text null unique,
  barcode text not null default '',
  packaging_type_id uuid null references public.packaging_types(id) on delete set null,
  volume_ml integer null,
  quantity_per_pack integer not null default 1,
  unit_label text not null default 'unit',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_variants_family
  on public.product_variants(family_id);

create index if not exists idx_product_variants_volume
  on public.product_variants(volume_ml);

-- 5) Future distributor mapping (many-to-many)
create table if not exists public.wholesaler_product_variants (
  id uuid primary key default gen_random_uuid(),
  wholesaler_id uuid not null references public.wholesalers(id) on delete cascade,
  product_variant_id uuid not null references public.product_variants(id) on delete cascade,
  is_active boolean not null default true,
  lead_time_days integer not null default 0,
  created_at timestamptz not null default now(),
  unique (wholesaler_id, product_variant_id)
);

create index if not exists idx_wholesaler_product_variants_wholesaler
  on public.wholesaler_product_variants(wholesaler_id);

create index if not exists idx_wholesaler_product_variants_variant
  on public.wholesaler_product_variants(product_variant_id);

-- 6) Optional operational metadata for heavy/bulk/cold-chain handling
alter table if exists public."OrderItems"
  add column if not exists handling_class text not null default 'standard',
  add column if not exists requires_cold_chain boolean not null default false,
  add column if not exists is_returnable_container boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orderitems_handling_class_check'
  ) then
    alter table if exists public."OrderItems"
      add constraint orderitems_handling_class_check
      check (handling_class in ('standard', 'heavy', 'fragile', 'cold'));
  end if;
end $$;

-- 7) Compatibility view for future API adoption without breaking existing fields
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
