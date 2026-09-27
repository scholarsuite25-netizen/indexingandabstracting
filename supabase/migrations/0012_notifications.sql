-- LIS 815 LMS — 0012_notifications.sql
-- Notification preferences and email tracking

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  assessment_reminders boolean not null default true,
  grade_notifications boolean not null default true,
  certificate_notifications boolean not null default true,
  announcements boolean not null default true,
  admin_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.get_notification_preferences(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefs record;
begin
  select * into v_prefs from public.notification_preferences where user_id = p_user_id;
  if not found then
    return jsonb_build_object(
      'email_enabled', true,
      'assessment_reminders', true,
      'grade_notifications', true,
      'certificate_notifications', true,
      'announcements', true,
      'admin_alerts', true
    );
  end if;
  return to_jsonb(v_prefs);
end;
$$;

create or replace function public.set_notification_preferences(
  p_user_id uuid,
  p_email_enabled boolean default null,
  p_assessment_reminders boolean default null,
  p_grade_notifications boolean default null,
  p_certificate_notifications boolean default null,
  p_announcements boolean default null,
  p_admin_alerts boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefs record;
begin
  insert into public.notification_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.notification_preferences
  set
    email_enabled = coalesce(p_email_enabled, email_enabled),
    assessment_reminders = coalesce(p_assessment_reminders, assessment_reminders),
    grade_notifications = coalesce(p_grade_notifications, grade_notifications),
    certificate_notifications = coalesce(p_certificate_notifications, certificate_notifications),
    announcements = coalesce(p_announcements, announcements),
    admin_alerts = coalesce(p_admin_alerts, admin_alerts),
    updated_at = now()
  where user_id = p_user_id;

  select * into v_prefs from public.notification_preferences where user_id = p_user_id;
  return to_jsonb(v_prefs);
end;
$$;

-- Email send log for tracking and debugging
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  subject text not null,
  template_type text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_log_user_idx on public.email_log (user_id, created_at desc);
create index if not exists email_log_status_idx on public.email_log (status, created_at desc);

-- RLS policies
alter table public.notification_preferences enable row level security;
alter table public.email_log enable row level security;

drop policy if exists notification_prefs_select on public.notification_preferences;
create policy notification_prefs_select on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_prefs_update on public.notification_preferences;
create policy notification_prefs_update on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notification_prefs_insert on public.notification_preferences;
create policy notification_prefs_insert on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists email_log_select on public.email_log;
create policy email_log_select on public.email_log
  for select to authenticated using (
    user_id = auth.uid() or public.is_admin()
  );

drop policy if exists email_log_insert on public.email_log;
create policy email_log_insert on public.email_log
  for insert to authenticated with check (true);

-- Grant permissions
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert on public.email_log to authenticated;