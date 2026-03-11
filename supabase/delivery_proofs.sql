create table if not exists public."DeliveryProofs" (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public."Orders"(id) on delete cascade,
  driver_id uuid null,
  proof_url text not null,
  notes text not null default '',
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_proofs_order_id
  on public."DeliveryProofs" (order_id);

create index if not exists idx_delivery_proofs_driver_id
  on public."DeliveryProofs" (driver_id);

