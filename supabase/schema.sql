-- Aridia items table + Row Level Security
-- Paste this into the Supabase SQL editor (Dashboard → SQL → New query).

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  description text,
  type text not null default 'task' check (type in ('task', 'event')),
  status text not null default 'active' check (status in ('active', 'completed')),
  deadline date,
  end_deadline date,
  start_time text,
  end_time text,
  time text,
  energy int,
  priority int,
  duration int,
  task_type jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_user_id_idx on public.items (user_id);
create index if not exists items_user_deadline_idx on public.items (user_id, deadline);

alter table public.items enable row level security;
alter table public.items force row level security;

revoke all on table public.items from public;
revoke all on table public.items from anon;
grant select, insert, update, delete on table public.items to authenticated;

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (auth.uid() = user_id);

create or replace function public.set_items_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_items_updated_at() from public;
revoke all on function public.set_items_updated_at() from anon;
revoke all on function public.set_items_updated_at() from authenticated;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute procedure public.set_items_updated_at();
