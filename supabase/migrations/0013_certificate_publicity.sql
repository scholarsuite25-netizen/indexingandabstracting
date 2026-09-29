-- ============ 0013 — Certificates: public verification, automatic issuance, revocation ============
--
-- Three faults found by the Phase 10 audit:
--
--   1. /verify/[number] could never work for a signed-out visitor. The page reads
--      through the anon client, but certificates_select is `to authenticated` and the
--      schema has no anon policy, so every public lookup returned "not found".
--      Fixed with a SECURITY DEFINER read that returns only the handful of fields a
--      stranger is allowed to see, rate-limited and audited.
--
--   2. Certificates were only ever attempted from inside mark_lesson_complete, so a
--      learner whose theory grade was released last never received one. Issuance now
--      also runs when a theory grade is released, controlled by the existing
--      auto_issue_certificates setting.
--
--   3. Nothing could revoke a certificate: the status and reason columns existed, and
--      the public page already renders them, but there was no function, no permission
--      check and no audit line. Added revoke_certificate().
--
-- The dead `certificate_prefix` and `institution` settings are wired up on the way past.

-- ============ Settings helpers ============

create or replace function public.get_setting_text(p_key text, p_default text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  v := nullif(public.get_setting(p_key) #>> '{}', '');
  return coalesce(v, p_default);
exception when others then
  return p_default;
end;
$$;

create or replace function public.get_setting_bool(p_key text, p_default boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  v := nullif(public.get_setting(p_key) #>> '{}', '');
  if v is null then
    return p_default;
  end if;
  return v::boolean;
exception when others then
  return p_default;
end;
$$;

-- ============ Eligibility: the practical component, off by default ============
--
-- The claim in IMPLEMENTATION_CHECKLIST.md was "required lessons + objective + theory
-- (configurable) + practicals if enabled". The practical half did not exist. It does
-- now: flip require_practicals on in system settings and every required practical
-- activity must be graded at or above practical_pass_mark.

create or replace function public.certificate_eligible(p_user_id uuid, p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_done int;
  v_objective numeric;
  v_theory numeric;
  v_objective_pass int;
  v_theory_pass int;
  v_prac_total int := 0;
  v_prac_done int := 0;
  v_prac_pass int;
  v_requires_pracs boolean;
begin
  select count(*), count(*) filter (
    where exists (
      select 1 from public.lesson_progress lp
      where lp.lesson_id = l.id and lp.user_id = p_user_id and lp.status = 'completed'
    )
  )
  into v_total, v_done
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where m.course_id = p_course_id and l.is_required and l.status = 'published';

  v_objective := coalesce(public.best_objective_percentage(p_course_id, p_user_id), 0);

  select coalesce(max(ts.total_score), 0) into v_theory
  from public.theory_submissions ts
  where ts.user_id = p_user_id
    and ts.assessment_id in (
      select id from public.assessments where course_id = p_course_id and type = 'theory'
    )
    and ts.status in ('graded', 'released');

  v_objective_pass := public.get_setting_int('objective_pass_mark', 50);
  v_theory_pass := public.get_setting_int('theory_pass_mark', 50);

  v_requires_pracs := public.get_setting_bool('require_practicals', false);
  if v_requires_pracs then
    -- Practical scores are out of 10 (the staff grader enforces that range), so the
    -- pass mark is on the same scale rather than a percentage.
    v_prac_pass := public.get_setting_int('practical_pass_mark', 8);

    select count(*), count(*) filter (
      where exists (
        select 1 from public.practical_submissions ps
        where ps.activity_id = pa.id
          and ps.user_id = p_user_id
          and ps.status = 'graded'
          and coalesce(ps.score, 0) >= v_prac_pass
      )
    )
    into v_prac_total, v_prac_done
    from public.practical_activities pa
    where pa.course_id = p_course_id and pa.is_required and pa.status = 'published';
  end if;

  return jsonb_build_object(
    'eligible',
      v_total = v_done and v_total > 0
      and v_objective >= v_objective_pass
      and coalesce(v_theory, 0) >= v_theory_pass
      and (v_prac_total = 0 or v_prac_done = v_prac_total),
    'lessons', jsonb_build_object('done', v_done, 'total', v_total),
    'objective', jsonb_build_object('best', v_objective, 'pass_mark', v_objective_pass),
    'theory', jsonb_build_object('best', coalesce(v_theory, 0), 'pass_mark', v_theory_pass),
    'practicals', jsonb_build_object(
      'done', v_prac_done, 'total', v_prac_total,
      'pass_mark', coalesce(v_prac_pass, 8), 'required', v_requires_pracs
    )
  );
end;
$$;

-- ============ Issuance ============
--
-- issue_certificate_core() does the work with no authorisation check, so that
-- server-side flows which have already proved who they are (releasing a grade,
-- completing a lesson) do not have to pass a check written for browser callers.
-- issue_certificate() keeps its original signature and authorisation rules and
-- delegates.

create or replace function public.issue_certificate_core(
  p_user_id uuid,
  p_course_id uuid,
  p_force boolean,
  p_issued_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_eligibility jsonb;
  v_id uuid;
  v_number text;
  v_prefix text;
begin
  select id into v_id
  from public.certificates
  where user_id = p_user_id and course_id = p_course_id and status = 'issued';

  if v_id is not null then
    return v_id;
  end if;

  v_eligibility := public.certificate_eligible(p_user_id, p_course_id);

  if not coalesce((v_eligibility ->> 'eligible')::boolean, false) and not p_force then
    raise exception 'Completion criteria are not met: %', v_eligibility;
  end if;

  -- The number has to be unguessable: a stranger can type it into /verify and read a
  -- name off it. gen_random_uuid gives 128 bits; ten hex characters of it is 40 bits,
  -- and public lookups are rate-limited on top of that.
  v_prefix := public.get_setting_text('certificate_prefix', 'LIS815');
  v_number := v_prefix || '-' || to_char(now(), 'YYYY') || '-' ||
    upper(substr(encode(uuid_send(gen_random_uuid()), 'hex'), 1, 10));

  insert into public.certificates (user_id, course_id, certificate_number, eligibility_snapshot, issued_by)
  values (p_user_id, p_course_id, v_number, v_eligibility, p_issued_by)
  returning id into v_id;

  perform public.notify(
    p_user_id,
    'certificate_issued',
    'Certificate of completion issued',
    'Your LIS 815 certificate is ready to download.',
    '/dashboard/certificate'
  );

  perform public.log_audit('certificate.issued', 'certificates', v_number, null,
    jsonb_build_object('forced', p_force, 'by', p_issued_by));

  return v_id;
end;
$$;

create or replace function public.issue_certificate(
  p_user_id uuid,
  p_course_id uuid,
  p_force boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not p_force and not public.is_course_staff(p_course_id) and p_user_id <> auth.uid() then
    raise exception 'Not authorised to issue certificates';
  end if;

  if p_force and not public.is_admin() then
    raise exception 'Only administrators can force certificate issuance';
  end if;

  return public.issue_certificate_core(p_user_id, p_course_id, p_force, auth.uid());
end;
$$;

-- ============ Automatic issuance when a theory grade is released ============
--
-- Before this, the only caller was mark_lesson_complete, which a learner who had
-- just had their final grade released may never touch again. The certificate now
-- appears the moment the last requirement is lifted. A failure here must never
-- undo a release the marker pressed a button for, so it is swallowed after logging.

create or replace function public.release_theory_grade(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_graded int;
  v_needed int;
  v_pass int;
  v_course_id uuid;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to release grades';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  v_course_id := public.course_of_submission(s.id);

  if not public.is_course_staff_for(v_course_id, auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to release this paper';
  end if;

  if s.status = 'released' then
    raise exception 'This paper has already been released';
  end if;
  if s.status not in ('graded', 'under_review') then
    raise exception 'Every answer must be graded before release (this paper is %)', s.status;
  end if;

  select
    count(*),
    coalesce((select count(*) from public.theory_answers ta2
              where ta2.submission_id = s.id and ta2.status <> 'not_selected'), 5)
  into v_graded, v_needed
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = s.id;

  if v_graded < v_needed then
    raise exception 'Only % of % answers are graded', v_graded, v_needed;
  end if;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);

  update public.theory_submissions
  set status = 'released', released_at = coalesce(released_at, now()), updated_at = now()
  where id = p_submission_id;

  perform public.notify(
    s.user_id,
    'grade_released',
    'Theory examination graded',
    case when coalesce(s.total_score, 0) >= v_pass
      then 'You passed. Your marked paper and feedback are available.'
      else 'Your marked paper and feedback are available.'
    end,
    '/dashboard/theory/results/' || p_submission_id
  );

  perform public.log_audit(
    'theory.released', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('total_score', s.total_score, 'by', auth.uid())
  );

  if public.get_setting_bool('auto_issue_certificates', true) then
    begin
      perform public.issue_certificate_core(s.user_id, v_course_id, false, auth.uid());
    exception when others then
      perform public.log_audit(
        'certificate.auto_issue_failed', 'theory_submissions', p_submission_id::text, null,
        jsonb_build_object('error', SQLERRM)
      );
    end;
  end if;
end;
$$;

-- ============ Revocation ============

create or replace function public.revoke_certificate(p_certificate_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c record;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can revoke certificates';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'A revocation reason of at least 3 characters is required';
  end if;

  select * into c from public.certificates where id = p_certificate_id;
  if not found then
    raise exception 'Certificate not found';
  end if;
  if c.status = 'revoked' then
    raise exception 'This certificate has already been revoked';
  end if;

  update public.certificates
  set status = 'revoked',
      revoked_at = now(),
      revoked_reason = v_reason,
      updated_at = now()
  where id = p_certificate_id;

  perform public.log_audit('certificate.revoked', 'certificates', c.certificate_number,
    jsonb_build_object('status', c.status),
    jsonb_build_object('reason', v_reason, 'by', auth.uid()));
end;
$$;

-- ============ Public verification ============
--
-- Returns only what a stranger may know: the number, dates, status, reason, the course
-- title and the learner's name and institution. No user id, no email, no scores.
--
-- Rate limited against public.rate_limits (30 lookups a minute per caller address)
-- and audited either way, so a scrape attempt is visible.

create or replace function public.get_public_certificate(p_number text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ip text := 'unknown';
  v_window timestamptz;
  v_hits int := 0;
  v_max int := 30;
  v record;
begin
  if p_number is null or length(btrim(p_number)) < 4 then
    return jsonb_build_object('found', false);
  end if;

  -- Supabase passes the caller's address in x-forwarded-for. If it is not there,
  -- lookup still works but is not individually limited.
  begin
    v_ip := btrim(split_part(
      coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''),
      ',', 1));
    if v_ip = '' then
      v_ip := 'unknown';
    end if;
  exception when others then
    v_ip := 'unknown';
  end;

  v_window := date_trunc('minute', now());

  if v_ip <> 'unknown' then
    select coalesce(sum(count), 0) into v_hits
    from public.rate_limits
    where bucket = 'certificate.verify'
      and key = v_ip
      and window_start > now() - interval '1 minute';

    if v_hits >= v_max then
      return jsonb_build_object('found', false, 'rate_limited', true);
    end if;

    insert into public.rate_limits (bucket, key, window_start, count)
    values ('certificate.verify', v_ip, v_window, 1)
    on conflict (bucket, key, window_start)
    do update set count = public.rate_limits.count + 1;
  end if;

  select
    c.certificate_number, c.issued_at, c.status, c.revoked_at, c.revoked_reason,
    co.code, co.title, p.full_name, p.institution
  into v
  from public.certificates c
  join public.courses co on co.id = c.course_id
  join public.profiles p on p.id = c.user_id
  where c.certificate_number = btrim(p_number);

  if not found then
    perform public.log_audit('certificate.verify', 'certificates', btrim(p_number), null,
      jsonb_build_object('result', 'not_found', 'ip', v_ip));
    return jsonb_build_object('found', false);
  end if;

  perform public.log_audit('certificate.verify', 'certificates', btrim(p_number), null,
    jsonb_build_object('result', v.status, 'ip', v_ip));

  return jsonb_build_object(
    'found', true,
    'number', v.certificate_number,
    'issued_at', v.issued_at,
    'status', v.status,
    'revoked_at', v.revoked_at,
    'revoked_reason', v.revoked_reason,
    'course_code', v.code,
    'course_title', v.title,
    'student_name', v.full_name,
    -- The `institution` setting is what the certificate prints when the learner's own
    -- profile field is empty; it used to be written by the seed and never read.
    'institution', coalesce(nullif(v.institution, ''), public.get_setting_text('institution', ''))
  );
end;
$$;

grant execute on function public.get_public_certificate(text) to anon, authenticated;
grant execute on function public.revoke_certificate(uuid, text) to authenticated;
grant execute on function public.issue_certificate(uuid, uuid, boolean) to authenticated;

-- ============ Settings the eligibility rule reads ============
--
-- Off by default, so nothing about who qualifies changes until an administrator turns
-- it on. `auto_issue_certificates` and `certificate_prefix` were seeded back in 0004 and
-- never read by anything; they are live now.

insert into public.system_settings (key, value, description, is_secret)
values
  ('require_practicals', 'false'::jsonb,
   'Require every required practical activity to be graded at or above practical_pass_mark before a certificate can be issued', false),
  ('practical_pass_mark', '8'::jsonb,
   'Practical pass mark out of 10, used only when require_practicals is on', false)
on conflict (key) do nothing;
