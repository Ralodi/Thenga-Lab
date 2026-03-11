-- Product pricing controls: base cost + margin model
alter table public."Products"
  add column if not exists base_cost numeric(12,2),
  add column if not exists margin_type text not null default 'fixed',
  add column if not exists margin_value numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_margin_type_check'
  ) then
    alter table public."Products"
      add constraint products_margin_type_check
      check (margin_type in ('fixed', 'percent'));
  end if;
end $$;

update public."Products"
set base_cost = coalesce(base_cost, price);

-- Snapshot fields in OrderItems for settlement calculations
alter table public."OrderItems"
  add column if not exists wholesaler_id uuid references public.wholesalers(id) on delete set null,
  add column if not exists base_cost_snapshot numeric(12,2),
  add column if not exists margin_type_snapshot text,
  add column if not exists margin_value_snapshot numeric(12,2),
  add column if not exists margin_amount_snapshot numeric(12,2),
  add column if not exists wholesaler_payout_snapshot numeric(12,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orderitems_margin_type_snapshot_check'
  ) then
    alter table public."OrderItems"
      add constraint orderitems_margin_type_snapshot_check
      check (
        margin_type_snapshot is null
        or margin_type_snapshot in ('fixed', 'percent')
      );
  end if;
end $$;

create index if not exists idx_orderitems_wholesaler_id on public."OrderItems"(wholesaler_id);

-- Settlement records (optional manual pay-run tracking)
create table if not exists public.wholesaler_settlements (
  id uuid primary key default gen_random_uuid(),
  wholesaler_id uuid not null references public.wholesalers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  gross_sales numeric(14,2) not null default 0,
  total_margin numeric(14,2) not null default 0,
  delivery_fees numeric(14,2) not null default 0,
  amount_owed numeric(14,2) not null default 0,
  status text not null default 'open',
  notes text not null default '',
  paid_at timestamptz null,
  payment_reference text not null default '',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'wholesaler_settlements_status_check'
  ) then
    alter table public.wholesaler_settlements
      add constraint wholesaler_settlements_status_check
      check (status in ('open', 'approved', 'paid'));
  end if;
end $$;

create index if not exists idx_wholesaler_settlements_wholesaler on public.wholesaler_settlements(wholesaler_id);
create index if not exists idx_wholesaler_settlements_period on public.wholesaler_settlements(period_start, period_end);

-- Live owed view from delivered/completed orders
create or replace view public.vw_wholesaler_owed_live as
select
  oi.wholesaler_id,
  coalesce(w.name, 'Unknown wholesaler') as wholesaler_name,
  round(sum(
    coalesce(
      oi.wholesaler_payout_snapshot,
      (coalesce(oi.price, 0) * coalesce(oi.quantity, 0)) - coalesce(oi.margin_amount_snapshot, 0)
    )
  )::numeric, 2) as amount_owed,
  round(sum((coalesce(oi.price, 0) * coalesce(oi.quantity, 0))::numeric), 2) as gross_sales,
  round(sum(coalesce(oi.margin_amount_snapshot, 0)::numeric), 2) as total_margin,
  count(distinct o.id) as delivered_orders
from public."Orders" o
join public."OrderItems" oi on oi.order_id = o.id
left join public.wholesalers w on w.id = oi.wholesaler_id
where o.status = 'Completed'
  and oi.wholesaler_id is not null
group by oi.wholesaler_id, w.name;
