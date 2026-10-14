-- Run in Supabase SQL editor after existing party migrations.
create table if not exists public.party_readiness (
 party_id uuid not null references public.parties(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 ready boolean not null default false,
 supplies_ready boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (party_id,user_id)
);
alter table public.party_readiness enable row level security;
create policy "party readiness readable" on public.party_readiness for select to authenticated using (
 exists (select 1 from public.party_slots s where s.party_id=party_readiness.party_id and s.user_id=auth.uid())
 or exists (select 1 from public.parties p where p.id=party_readiness.party_id and p.creator_id=auth.uid())
);
create policy "members set own readiness" on public.party_readiness for insert to authenticated with check (
 user_id=auth.uid() and exists(select 1 from public.party_slots s where s.party_id=party_readiness.party_id and s.user_id=auth.uid())
);
create policy "members update own readiness" on public.party_readiness for update to authenticated using (user_id=auth.uid()) with check (
 user_id=auth.uid() and exists(select 1 from public.party_slots s where s.party_id=party_readiness.party_id and s.user_id=auth.uid())
);
