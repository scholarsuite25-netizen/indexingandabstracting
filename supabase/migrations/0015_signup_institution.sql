-- LIS 815 LMS — 0015_signup_institution.sql
-- Registration now asks for the learner's institution. The column
-- (profiles.institution) and the profile screen already existed; what never
-- happened was the signup trigger reading it, so the answer was collected and
-- then dropped on the floor. This replaces handle_new_user() to carry it over.
-- Safe to run more than once (create or replace, no rows touched).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, institution)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'institution', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.roles (code, name)
  values ('student', 'Student')
  on conflict (code) do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.code = 'student'
  on conflict do nothing;

  return new;
end;
$$;
