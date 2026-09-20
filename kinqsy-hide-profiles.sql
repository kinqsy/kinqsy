-- 1) убрать дыры: любой может читать все посты
drop policy if exists "Anyone can read posts" on public.posts;
drop policy if exists "Public read posts" on public.posts;

-- на всякий случай ещё типичные имена
drop policy if exists "Enable read access for all users" on public.posts;
drop policy if exists posts_select on public.posts;

-- 2) функция дружбы (если уже есть — просто обновится)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    a is not null
    and b is not null
    and (
      a = b
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = a and f.addressee_id = b)
            or (f.requester_id = b and f.addressee_id = a)
          )
      )
    );
$$;

grant execute on function public.are_friends(uuid, uuid) to anon, authenticated;

-- 3) поиск ТОЛЬКО по точному коду (иначе после закрытия профилей «код не найден»)
create or replace function public.lookup_friend_code(p_code text)
returns table(id uuid, display_name text, friend_code text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.friend_code
  from public.profiles p
  where p.friend_code is not null
    and upper(p.friend_code) = upper(trim(p_code))
  limit 1;
$$;

grant execute on function public.lookup_friend_code(text) to authenticated;

-- 4) профили: свой или друг. гости / не-други — пусто
alter table public.profiles enable row level security;

drop policy if exists "Public profiles" on public.profiles;
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "Enable read access for all users" on public.profiles;
drop policy if exists profiles_select_friends on public.profiles;

create policy profiles_select_friends
on public.profiles
for select
using (
  auth.uid() = id
  or public.are_friends(auth.uid(), id)
);

-- запись профиля только себе
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);
