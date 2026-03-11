create table if not exists public.customer_loyalty (
  loyalty_key text primary key,
  user_id uuid null,
  customer_name text not null default '',
  contact_number text not null default '',
  total_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_loyalty_user_id
  on public.customer_loyalty (user_id);

create table if not exists public.loyalty_points_ledger (
  id uuid primary key default gen_random_uuid(),
  order_db_id uuid not null unique references public."Orders"(id) on delete cascade,
  order_id text not null,
  loyalty_key text not null references public.customer_loyalty(loyalty_key) on delete cascade,
  user_id uuid null,
  points_earned_base integer not null default 0,
  points_earned_bonus integer not null default 0,
  points_earned integer not null,
  points_redeemed integer not null default 0,
  redemption_value numeric(12,2) not null default 0,
  order_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);

alter table public.loyalty_points_ledger
  add column if not exists points_earned_base integer not null default 0,
  add column if not exists points_earned_bonus integer not null default 0,
  add column if not exists points_redeemed integer not null default 0,
  add column if not exists redemption_value numeric(12,2) not null default 0;

create index if not exists idx_loyalty_points_ledger_loyalty_key
  on public.loyalty_points_ledger (loyalty_key);

create index if not exists idx_loyalty_points_ledger_user_id
  on public.loyalty_points_ledger (user_id);
