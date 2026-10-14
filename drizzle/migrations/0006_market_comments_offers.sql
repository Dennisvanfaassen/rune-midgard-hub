-- Run this migration in the Supabase SQL editor before deploying the marketplace UI.
create table if not exists public.market_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists market_comments_listing_date_idx on public.market_comments(listing_id,created_at);
alter table public.market_comments enable row level security;
create policy "read marketplace comments" on public.market_comments for select to anon,authenticated using (true);
create policy "post own marketplace comments" on public.market_comments for insert to authenticated with check (author_id=auth.uid());
create policy "delete own marketplace comments" on public.market_comments for delete to authenticated using (author_id=auth.uid());

create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount>0 and amount<=1000000000000),
  message text check (message is null or char_length(message)<=500),
  status text not null default 'pending' check (status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists market_offers_listing_date_idx on public.market_offers(listing_id,created_at desc);
create index if not exists market_offers_buyer_idx on public.market_offers(buyer_id);
alter table public.market_offers enable row level security;
create policy "participants read marketplace offers" on public.market_offers for select to authenticated using (
  buyer_id=auth.uid() or exists(select 1 from public.market_listings l where l.id=listing_id and l.seller_id=auth.uid())
);
create policy "buyers create marketplace offers" on public.market_offers for insert to authenticated with check (
  buyer_id=auth.uid() and status='pending' and responded_at is null
  and exists(select 1 from public.market_listings l where l.id=listing_id and l.seller_id<>auth.uid() and l.status='open')
);
-- Seller decisions run through an RPC to prevent changes to offer amount or buyer.
create or replace function public.market_respond_offer(p_offer uuid,p_action text)
returns void language plpgsql security definer set search_path=public as $$
declare offer_rec public.market_offers%rowtype;
begin
  if p_action not in ('accepted','declined') then raise exception 'Invalid response'; end if;
  select * into offer_rec from public.market_offers where id=p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  if not exists(select 1 from public.market_listings where id=offer_rec.listing_id and seller_id=auth.uid()) then raise exception 'Only the seller may respond'; end if;
  if offer_rec.status<>'pending' then raise exception 'Offer already handled'; end if;
  update public.market_offers set status=p_action,responded_at=now() where id=p_offer;
end; $$;
revoke all on function public.market_respond_offer(uuid,text) from public;
grant execute on function public.market_respond_offer(uuid,text) to authenticated;

create or replace function public.market_withdraw_offer(p_offer uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.market_offers set status='withdrawn',responded_at=now()
  where id=p_offer and buyer_id=auth.uid() and status='pending';
  if not found then raise exception 'Offer is unavailable or already handled'; end if;
end; $$;
revoke all on function public.market_withdraw_offer(uuid) from public;
grant execute on function public.market_withdraw_offer(uuid) to authenticated;
