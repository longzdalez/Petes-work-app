-- Pete Work: run this once in Supabase → SQL Editor → New query → Run.

-- 1. One table holds everything (jobs, materials, money, invoices…)
create table if not exists public.records (
  id text primary key,
  kind text not null,
  job_id text,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists records_updated_at on public.records (updated_at);

-- The server stamps the time on every change so both phones stay in step
create or replace function public.stamp_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := clock_timestamp(); return new; end $$;
drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records
  for each row execute function public.stamp_updated_at();

-- 2. Only your shared login can see the data.
-- The first account ever created is the team login; anyone else who signs up gets nothing.
create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and auth.uid() = (select id from auth.users order by created_at asc limit 1)
$$;

alter table public.records enable row level security;
drop policy if exists team_all on public.records;
create policy team_all on public.records for all to authenticated
  using (public.is_team()) with check (public.is_team());
grant select, insert, update, delete on public.records to authenticated;
revoke all on public.records from anon;

-- 3. Live updates between phones
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; end $$;

-- 4. Storage for job documents (private)
insert into storage.buckets (id, name, public) values ('docs', 'docs', false)
  on conflict (id) do nothing;
drop policy if exists docs_team on storage.objects;
create policy docs_team on storage.objects for all to authenticated
  using (bucket_id = 'docs' and public.is_team())
  with check (bucket_id = 'docs' and public.is_team());

-- 5. Confirm the very first account straight away (no email link needed)
create or replace function public.autoconfirm_first() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users) then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists autoconfirm_first on auth.users;
create trigger autoconfirm_first before insert on auth.users
  for each row execute function public.autoconfirm_first();
