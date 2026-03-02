-- Store Stripe invoices for customers

create table if not exists public.invoices (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text null,
  stripe_invoice_id text not null unique,
  status text null,
  currency text null,
  total bigint null,
  amount_due bigint null,
  amount_paid bigint null,
  amount_remaining bigint null,
  invoice_number text null,
  hosted_invoice_url text null,
  invoice_pdf text null,
  collection_method text null,
  due_date timestamptz null,
  period_start timestamptz null,
  period_end timestamptz null,
  paid boolean null,
  created timestamptz null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_customer_id_idx on public.invoices(stripe_customer_id);
create index if not exists invoices_subscription_id_idx on public.invoices(stripe_subscription_id);
create index if not exists invoices_status_idx on public.invoices(status);

alter table public.invoices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_select_own'
  ) then
    create policy invoices_select_own
      on public.invoices
      for select
      using (auth.uid() = user_id);
  end if;
end $$;
