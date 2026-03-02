-- Stripe billing tables for Second Brain

create table if not exists public.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text null,
  stripe_subscription_id text not null unique,
  status text not null,
  price_id text null,
  quantity integer null,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  canceled_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);

alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'stripe_customers' and policyname = 'stripe_customers_select_own'
  ) then
    create policy stripe_customers_select_own
      on public.stripe_customers
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select_own'
  ) then
    create policy subscriptions_select_own
      on public.subscriptions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;
