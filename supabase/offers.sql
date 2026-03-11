create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  image_url text not null default '',
  bg_color text not null default '#0f3b74',
  text_color text not null default '#ffffff',
  cta_text text not null default '',
  cta_link text not null default '',
  bonus_points integer not null default 0,
  min_order_total numeric(12,2) null,
  campaign_priority integer not null default 100,
  is_stackable boolean not null default false,
  area text null,
  wholesaler_id uuid null references public.wholesalers(id) on delete set null,
  is_active boolean not null default true,
  start_at timestamptz null,
  end_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_offers_active on public.offers (is_active);
create index if not exists idx_offers_area on public.offers (area);
create index if not exists idx_offers_wholesaler on public.offers (wholesaler_id);

alter table public.offers
  add column if not exists bonus_points integer not null default 0,
  add column if not exists min_order_total numeric(12,2) null,
  add column if not exists campaign_priority integer not null default 100,
  add column if not exists is_stackable boolean not null default false;

create index if not exists idx_offers_campaign_priority on public.offers (campaign_priority);

-- Storage bucket for offer banner images (used by admin upload + customer slideshow)
insert into storage.buckets (id, name, public)
values ('offer-banners', 'offer-banners', true)
on conflict (id) do nothing;

-- Public read access for banner images
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read offer banners'
  ) then
    create policy "Public read offer banners"
      on storage.objects
      for select
      to public
      using (bucket_id = 'offer-banners');
  end if;
end $$;

-- Authenticated users can upload/update/delete banner images
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated upload offer banners'
  ) then
    create policy "Authenticated upload offer banners"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'offer-banners');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated update offer banners'
  ) then
    create policy "Authenticated update offer banners"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'offer-banners')
      with check (bucket_id = 'offer-banners');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated delete offer banners'
  ) then
    create policy "Authenticated delete offer banners"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'offer-banners');
  end if;
end $$;
