-- замок дневника на стороне базы (обход через URL не поможет)
-- выполнить в Supabase → SQL Editor

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

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to anon, authenticated;

alter table public.posts enable row level security;

drop policy if exists "posts_select" on public.posts;
drop policy if exists "posts_select_owner" on public.posts;
drop policy if exists "Enable read access for all users" on public.posts;
drop policy if exists posts_select_friends on public.posts;

create policy posts_select_friends
on public.posts
for select
using (
  auth.uid() = user_id
  or public.are_friends(auth.uid(), user_id)
);

drop policy if exists posts_insert_own on public.posts;
create policy posts_insert_own
on public.posts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own
on public.posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists posts_delete_own on public.posts;
create policy posts_delete_own
on public.posts
for delete
to authenticated
using (auth.uid() = user_id);
