create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text not null,
  contact_number text not null default '',
  car_model text not null,
  reg_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_profiles_active
  on public.driver_profiles (is_active);

create index if not exists idx_driver_profiles_name
  on public.driver_profiles (full_name);

