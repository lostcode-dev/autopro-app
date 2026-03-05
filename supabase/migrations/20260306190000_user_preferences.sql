-- User appearance and theme preferences
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_color text not null default 'green',
  neutral_color text not null default 'slate',
  color_mode text not null default 'dark',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- RLS
alter table public.user_preferences enable row level security;

create policy "Users can view own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

-- Updated at trigger
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row
  execute function public.set_updated_at();

-- Index
create index if not exists idx_user_preferences_user_id
  on public.user_preferences(user_id);
