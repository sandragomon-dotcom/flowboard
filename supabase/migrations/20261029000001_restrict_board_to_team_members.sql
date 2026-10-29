-- Allowlist of accounts that may use the shared board. Managed by the project owner via SQL/dashboard only.
create table public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.team_members enable row level security;

-- Membership check used by every policy.
create function public.is_team_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (select 1 from public.team_members where user_id = (select auth.uid()));
$$;
revoke all on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

-- First member: add yourself after applying, e.g.
--   insert into public.team_members (user_id) select id from auth.users where email = '<your email>';

-- A signed-in user may see only their own membership row; nobody can change membership from the app.
create policy "Members can see their own membership" on public.team_members
  for select to authenticated using (user_id = (select auth.uid()));

-- Replace the "any signed-in user" policies.
drop policy if exists "Team can view cards" on public.cards;
drop policy if exists "Team can add cards" on public.cards;
drop policy if exists "Team can update cards" on public.cards;
drop policy if exists "Team can delete cards" on public.cards;
drop policy if exists "Team can view columns" on public.columns;
drop policy if exists "Team can add columns" on public.columns;
drop policy if exists "Team can update columns" on public.columns;
drop policy if exists "Team can delete columns" on public.columns;

create policy "Members can view cards" on public.cards
  for select to authenticated using ((select public.is_team_member()));
create policy "Members can add cards" on public.cards
  for insert to authenticated with check ((select public.is_team_member()) and created_by = (select auth.uid()));
create policy "Members can update cards" on public.cards
  for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));
create policy "Members can delete cards" on public.cards
  for delete to authenticated using ((select public.is_team_member()));

create policy "Members can view columns" on public.columns
  for select to authenticated using ((select public.is_team_member()));
create policy "Members can add columns" on public.columns
  for insert to authenticated with check ((select public.is_team_member()));
create policy "Members can update columns" on public.columns
  for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));
create policy "Members can delete columns" on public.columns
  for delete to authenticated using ((select public.is_team_member()));

-- Least privilege on table grants: signed-out visitors get nothing; signed-in users get only row CRUD.
revoke all on public.cards, public.columns, public.team_members from anon;
revoke truncate, references, trigger on public.cards, public.columns from authenticated;
revoke all on public.team_members from authenticated;
grant select on public.team_members to authenticated;

-- Input limits matching the app, enforced server-side.
alter table public.cards
  add constraint cards_title_len check (char_length(title) <= 120),
  add constraint cards_assignee_len check (char_length(assignee) <= 60);
alter table public.columns
  add constraint columns_name_len check (char_length(name) <= 40);
