-- Rune Midgard membership roles and owner-only administration.
-- IMPORTANT: after running this file, grant yourself admin using the bootstrap
-- command at the bottom, replacing YOUR_AUTH_USER_UUID with your own auth.users ID.
create table if not exists public.guild_member_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'Guildmember' check (role in ('Admin','Officer','Guildmember')),
  updated_at timestamptz not null default now()
);
alter table public.guild_member_roles enable row level security;
create policy "read guild roles" on public.guild_member_roles
  for select to authenticated using (true);
-- Only security-definer functions can change roles; never grant client-side writes.
revoke insert, update, delete on public.guild_member_roles from anon, authenticated;
grant select on public.guild_member_roles to authenticated;

create or replace function public.guild_my_role()
returns text language sql security definer set search_path=public stable as $$
  select coalesce((select r.role from public.guild_member_roles r where r.user_id=auth.uid()),'Guildmember');
$$;
revoke all on function public.guild_my_role() from public;
grant execute on function public.guild_my_role() to authenticated;

create or replace function public.guild_set_role(target_user uuid, new_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.guild_my_role() <> 'Admin' then
    raise exception 'Administrator access required';
  end if;
  if new_role not in ('Officer','Guildmember') then
    raise exception 'Only Officer and Guildmember can be assigned in the dashboard';
  end if;
  if target_user = auth.uid() then raise exception 'You cannot change your own administrator role'; end if;
  if not exists (select 1 from auth.users where id=target_user) then raise exception 'User not found'; end if;
  if exists (select 1 from public.guild_member_roles where user_id=target_user and role='Admin') then
    raise exception 'Cannot change another administrator';
  end if;
  insert into public.guild_member_roles(user_id,role) values(target_user,new_role)
    on conflict(user_id) do update set role=excluded.role,updated_at=now();
end; $$;
revoke all on function public.guild_set_role(uuid,text) from public;
grant execute on function public.guild_set_role(uuid,text) to authenticated;

create or replace function public.guild_delete_member(target_user uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or public.guild_my_role() <> 'Admin' then
    raise exception 'Administrator access required';
  end if;
  if target_user=auth.uid() then raise exception 'You cannot delete your own account'; end if;
  if exists (select 1 from public.guild_member_roles where user_id=target_user and role='Admin') then
    raise exception 'Cannot delete an administrator';
  end if;
  if not exists (select 1 from auth.users where id=target_user) then raise exception 'User not found'; end if;
  -- Deleting the auth identity revokes future sign-ins; dependent records must
  -- have appropriate cascades. A FK failure rolls back the transaction safely.
  delete from auth.users where id=target_user;
  if not found then raise exception 'User deletion failed'; end if;
end; $$;
revoke all on function public.guild_delete_member(uuid) from public;
grant execute on function public.guild_delete_member(uuid) to authenticated;

-- RUN ONCE AFTER INSTALLATION, with your real Supabase Authentication user ID:
-- insert into public.guild_member_roles(user_id,role)
-- values ('YOUR_AUTH_USER_UUID'::uuid,'Admin')
-- on conflict(user_id) do update set role='Admin';
