-- Named co-editors, matched by the email they sign in with.
create table public.map_collaborators (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  email text not null,
  invited_by uuid,
  created_at timestamptz not null default now(),
  unique (map_id, email)
);
create index map_collaborators_email_idx on public.map_collaborators (email);
create index map_collaborators_map_id_idx on public.map_collaborators (map_id);

-- View-only share links; anonymous viewing happens through a server function
-- that validates the token, so no anon grants here.
create table public.map_share_links (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  token text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index map_share_links_map_id_idx on public.map_share_links (map_id);

grant select, insert, delete on public.map_collaborators to authenticated;
grant all on public.map_collaborators to service_role;
grant select, insert, delete on public.map_share_links to authenticated;
grant all on public.map_share_links to service_role;

-- Security-definer helpers so policies can check map access without recursion.
create or replace function public.can_edit_map(_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.maps m
    where m.id = _map_id
      and (
        m.user_id = auth.uid()
        or exists (
          select 1 from public.map_collaborators c
          where c.map_id = m.id
            and c.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
  )
$$;

create or replace function public.can_edit_layer(_layer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_edit_map((select l.map_id from public.layers l where l.id = _layer_id))
$$;

revoke execute on function public.can_edit_map(uuid) from public, anon;
revoke execute on function public.can_edit_layer(uuid) from public, anon;
grant execute on function public.can_edit_map(uuid) to authenticated, service_role;
grant execute on function public.can_edit_layer(uuid) to authenticated, service_role;

alter table public.map_collaborators enable row level security;
alter table public.map_share_links enable row level security;

create policy "collaborators visible to owner and self"
on public.map_collaborators for select to authenticated
using (
  exists (select 1 from public.maps m where m.id = map_id and m.user_id = auth.uid())
  or email = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "owner adds collaborators"
on public.map_collaborators for insert to authenticated
with check (exists (select 1 from public.maps m where m.id = map_id and m.user_id = auth.uid()));

create policy "owner removes collaborators"
on public.map_collaborators for delete to authenticated
using (exists (select 1 from public.maps m where m.id = map_id and m.user_id = auth.uid()));

create policy "owner reads share links"
on public.map_share_links for select to authenticated
using (exists (select 1 from public.maps m where m.id = map_id and m.user_id = auth.uid()));

create policy "owner creates share links"
on public.map_share_links for insert to authenticated
with check (exists (select 1 from public.maps m where m.id = map_id and m.user_id = auth.uid()));

create policy "owner revokes share links"
on public.map_share_links for delete to authenticated
using (exists (select 1 from public.maps m where m.id = map_id and m.user_id = auth.uid()));

-- Widen the main tables so named co-editors get full access to shared maps.
drop policy if exists "own select" on public.maps;
drop policy if exists "own insert" on public.maps;
drop policy if exists "own update" on public.maps;
drop policy if exists "own delete" on public.maps;
create policy "owner or editor reads map"
on public.maps for select to authenticated
using (user_id = auth.uid() or public.can_edit_map(id));
create policy "owner creates map"
on public.maps for insert to authenticated
with check (user_id = auth.uid());
create policy "owner or editor updates map"
on public.maps for update to authenticated
using (user_id = auth.uid() or public.can_edit_map(id))
with check (user_id = auth.uid() or public.can_edit_map(id));
create policy "owner deletes map"
on public.maps for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "own select" on public.layers;
drop policy if exists "own insert" on public.layers;
drop policy if exists "own update" on public.layers;
drop policy if exists "own delete" on public.layers;
create policy "owner or editor reads layer"
on public.layers for select to authenticated
using (user_id = auth.uid() or public.can_edit_map(map_id));
create policy "owner or editor creates layer"
on public.layers for insert to authenticated
with check (public.can_edit_map(map_id));
create policy "owner or editor updates layer"
on public.layers for update to authenticated
using (user_id = auth.uid() or public.can_edit_map(map_id))
with check (public.can_edit_map(map_id));
create policy "owner or editor deletes layer"
on public.layers for delete to authenticated
using (user_id = auth.uid() or public.can_edit_map(map_id));

drop policy if exists "own select" on public.field_definitions;
drop policy if exists "own insert" on public.field_definitions;
drop policy if exists "own update" on public.field_definitions;
drop policy if exists "own delete" on public.field_definitions;
create policy "owner or editor reads field definition"
on public.field_definitions for select to authenticated
using (user_id = auth.uid() or public.can_edit_layer(layer_id));
create policy "owner or editor creates field definition"
on public.field_definitions for insert to authenticated
with check (public.can_edit_layer(layer_id));
create policy "owner or editor updates field definition"
on public.field_definitions for update to authenticated
using (user_id = auth.uid() or public.can_edit_layer(layer_id))
with check (public.can_edit_layer(layer_id));
create policy "owner or editor deletes field definition"
on public.field_definitions for delete to authenticated
using (user_id = auth.uid() or public.can_edit_layer(layer_id));

drop policy if exists "own select" on public.entries;
drop policy if exists "own insert" on public.entries;
drop policy if exists "own update" on public.entries;
drop policy if exists "own delete" on public.entries;
create policy "owner or editor reads entry"
on public.entries for select to authenticated
using (user_id = auth.uid() or public.can_edit_layer(layer_id));
create policy "owner or editor creates entry"
on public.entries for insert to authenticated
with check (public.can_edit_layer(layer_id));
create policy "owner or editor updates entry"
on public.entries for update to authenticated
using (user_id = auth.uid() or public.can_edit_layer(layer_id))
with check (public.can_edit_layer(layer_id));
create policy "owner or editor deletes entry"
on public.entries for delete to authenticated
using (user_id = auth.uid() or public.can_edit_layer(layer_id));
