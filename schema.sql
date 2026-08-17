-- ============================================================
-- XPERISE METRICS DASHBOARD — Supabase schema
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- ---------- 1. UPLOAD LOG ----------
create table if not exists uploads (
  id          uuid primary key default gen_random_uuid(),
  filename    text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  row_count   int    not null default 0,
  note        text
);

-- ---------- 2. MONTHLY ACTUALS ----------
-- One row per period. Revenue held in whole VND (bigint, never float).
create table if not exists monthly_actual (
  period            date    primary key,          -- always the 1st of the month
  -- revenue by stream, whole VND
  rev_travel        bigint  not null default 0,
  rev_mobility      bigint  not null default 0,
  rev_other         bigint  not null default 0,
  rev_subscription  bigint  not null default 0,
  rev_licence       bigint  not null default 0,
  rev_oneoff        bigint  not null default 0,
  -- customers and users
  total_customers   int     not null default 0,
  active_customers  int     not null default 0,
  total_users       int     not null default 0,
  active_users      int     not null default 0,
  -- provenance
  upload_id         uuid    references uploads(id) on delete set null,
  is_forecast       boolean not null default false,
  updated_at        timestamptz not null default now()
);

create index if not exists idx_actual_period on monthly_actual (period);

-- ---------- 3. TARGETS (entered by hand in the UI) ----------
create table if not exists monthly_target (
  period            date    primary key,
  target_revenue    bigint  not null default 0,
  target_customers  int     not null default 0,
  target_users      int     not null default 0,
  updated_at        timestamptz not null default now()
);

-- ---------- 4. KEEP updated_at HONEST ----------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_actual_touch on monthly_actual;
create trigger trg_actual_touch before update on monthly_actual
  for each row execute function touch_updated_at();

drop trigger if exists trg_target_touch on monthly_target;
create trigger trg_target_touch before update on monthly_target
  for each row execute function touch_updated_at();

-- ---------- 5. THE VIEW THE DASHBOARD READS ----------
-- Every derived number is computed here, never stored.
-- Change a definition once and the whole dashboard follows.
create or replace view v_monthly as
select
  a.period,
  a.is_forecast,

  -- revenue components
  a.rev_travel, a.rev_mobility, a.rev_other,
  a.rev_subscription, a.rev_licence, a.rev_oneoff,

  (a.rev_travel + a.rev_mobility + a.rev_other)          as rev_stream_a,
  (a.rev_subscription + a.rev_licence + a.rev_oneoff)    as rev_stream_b,
  (a.rev_travel + a.rev_mobility + a.rev_other
   + a.rev_subscription + a.rev_licence + a.rev_oneoff)  as total_revenue,

  -- counts
  a.total_customers, a.active_customers,
  a.total_users,     a.active_users,

  -- targets
  t.target_revenue, t.target_customers, t.target_users,

  -- achievement
  round(100.0 * (a.rev_travel + a.rev_mobility + a.rev_other
                 + a.rev_subscription + a.rev_licence + a.rev_oneoff)
        / nullif(t.target_revenue, 0), 1)                as revenue_pct,
  round(100.0 * a.total_customers
        / nullif(t.target_customers, 0), 1)              as customers_pct,
  round(100.0 * a.total_users
        / nullif(t.target_users, 0), 1)                  as users_pct,

  -- operating ratios
  round(100.0 * a.active_customers
        / nullif(a.total_customers, 0), 1)               as customer_active_rate,
  round(100.0 * a.active_users
        / nullif(a.total_users, 0), 1)                   as user_active_rate,

  -- revenue per customer, whole VND
  round((a.rev_travel + a.rev_mobility + a.rev_other
         + a.rev_subscription + a.rev_licence + a.rev_oneoff)::numeric
        / nullif(a.total_customers, 0), 0)               as arpc,

  -- revenue per customer excluding upfront licence fees
  round((a.rev_travel + a.rev_mobility + a.rev_other
         + a.rev_subscription + a.rev_oneoff)::numeric
        / nullif(a.total_customers, 0), 0)               as arpc_ex_licence,

  -- stream B share of total
  round(100.0 * (a.rev_subscription + a.rev_licence + a.rev_oneoff)
        / nullif(a.rev_travel + a.rev_mobility + a.rev_other
                 + a.rev_subscription + a.rev_licence + a.rev_oneoff, 0), 2)
                                                          as stream_b_share
from monthly_actual a
left join monthly_target t on t.period = a.period
order by a.period;

-- ---------- 6. ROW LEVEL SECURITY ----------
-- The dashboard has no login, so the anon key is public.
-- Read is open. Writes are open too, which is what makes this
-- convenient AND what makes it risky — see README before going live.
alter table monthly_actual enable row level security;
alter table monthly_target enable row level security;
alter table uploads        enable row level security;

drop policy if exists p_actual_all on monthly_actual;
create policy p_actual_all on monthly_actual for all using (true) with check (true);

drop policy if exists p_target_all on monthly_target;
create policy p_target_all on monthly_target for all using (true) with check (true);

drop policy if exists p_uploads_all on uploads;
create policy p_uploads_all on uploads for all using (true) with check (true);

-- ---------- 7. READ-ONLY VARIANT (recommended once live) ----------
-- Replace the three policies above with these to make the public site
-- read-only, and load data from a private admin page or a service key.
--
-- create policy p_actual_read on monthly_actual for select using (true);
-- create policy p_target_read on monthly_target for select using (true);
-- create policy p_uploads_read on uploads        for select using (true);
