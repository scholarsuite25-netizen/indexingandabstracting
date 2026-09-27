-- LIS 815 LMS — 0006_auth.sql
-- One-time superadmin claim, role-change auditing, avatar storage.

create or replace function public.claim_first_superadmin()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_admin_role_id uuid;
  v_exists boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(918273);

  select id into v_admin_role_id from public.roles where code = 'superadmin';

  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.code = 'superadmin'
  ) into v_exists;

  if v_exists then
    return jsonb_build_object(
      'claimed', false,
      'message', 'A superadmin already exists. Ask them to grant your account the admin role from the Users page.'
    );
  end if;

  if v_admin_role_id is null then
    insert into public.roles (code, name, description)
    values ('superadmin', 'Super Administrator', 'Full control including role management')
    returning id into v_admin_role_id;
  end if;

  insert into public.user_roles (user_id, role_id, granted_by)
  values (v_user_id, v_admin_role_id, v_user_id)
  on conflict do nothing;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (v_user_id, 'role.superadmin_claimed', 'user_roles', v_user_id::text,
          jsonb_build_object('role', 'superadmin'));

  update public.profiles
  set updated_at = now()
  where id = v_user_id;

  return jsonb_build_object(
    'claimed', true,
    'message', 'You are now the superadmin. Sign out and back in to load your new role.'
  );
end;
$$;

create or replace function public.superadmin_exists()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.code = 'superadmin'
  )
$$;

create or replace function public.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
begin
  select code into v_code from public.roles where id = coalesce(new.role_id, old.role_id);

  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
    values (auth.uid(), 'role.granted', 'user_roles',
            (coalesce(new.user_id::text, '') || ':' || coalesce(v_code, '')),
            jsonb_build_object('user_id', new.user_id, 'role', v_code, 'granted_by', new.granted_by));
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before)
  values (auth.uid(), 'role.revoked', 'user_roles',
          (coalesce(old.user_id::text, '') || ':' || coalesce(v_code, '')),
          jsonb_build_object('user_id', old.user_id, 'role', v_code));
  return old;
end;
$$;

drop trigger if exists user_roles_audit on public.user_roles;
create trigger user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function public.audit_role_change();

-- Avatar storage (only when running on Supabase, which has the storage schema).
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

  execute 'drop policy if exists "avatars_insert_own" on storage.objects';
  execute $p$
    create policy "avatars_insert_own" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;

  execute 'drop policy if exists "avatars_update_own" on storage.objects';
  execute $p$
    create policy "avatars_update_own" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;

  execute 'drop policy if exists "avatars_delete_own" on storage.objects';
  execute $p$
    create policy "avatars_delete_own" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  $p$;
end;
$$;
