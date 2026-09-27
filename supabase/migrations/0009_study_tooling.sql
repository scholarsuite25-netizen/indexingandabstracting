-- ============================================================
-- 0009 - Study tooling hardening (Phase 8)
--
-- Two rules the learner UI depends on, written where they cannot
-- be forgotten:
--
--   1. An examination paper is never a student resource, whatever
--      the visibility column says. Students sit the paper inside
--      the platform, where it is timed and marked for them.
--   2. A notification is written by the system and only ever read
--      by its owner. RLS already scopes the rows; this guard stops
--      an owner from rewriting their own title, link or body and
--      passing a forged message off as a platform notification.
-- ============================================================

-- ---------- 1. exam papers stay staff-side ----------

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and visibility = 'students'
      and kind <> 'exam_paper'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = resources.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

-- ---------- 2. notifications: read_at is the only editable field ----------

create or replace function public.notification_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.link is distinct from old.link
     or new.created_at is distinct from old.created_at then
    raise exception
      'A notification can only be marked read - its text and its recipient are set by the system.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard
  before update on public.notifications
  for each row
  execute function public.notification_guard();
