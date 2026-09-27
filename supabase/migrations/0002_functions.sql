-- LIS 815 LMS — 0002_functions.sql
-- Server-side rules: auth bootstrap, role helpers, reading/completion RPCs,
-- objective attempt lifecycle, theory 70% gate + exactly-5 rule, grading, certificates.

-- ============ Auth bootstrap ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Role and permission helpers (used inside RLS policies) ============

create or replace function public.current_user_roles()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(r.code), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'admin' = any (public.current_user_roles())
      or 'superadmin' = any (public.current_user_roles())
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'superadmin' = any (public.current_user_roles())
$$;

create or replace function public.has_permission(p_code text)
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
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code = p_code
  )
$$;

create or replace function public.is_course_staff(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (
    select 1 from public.course_staff cs
    where cs.course_id = p_course_id
      and cs.user_id = auth.uid()
  )
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.course_enrollments ce
    where ce.course_id = p_course_id
      and ce.user_id = auth.uid()
      and ce.status in ('active', 'completed')
  )
$$;

create or replace function public.get_setting(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select * into v from public.system_settings where key = p_key;
  if not found then
    return 'null'::jsonb;
  end if;
  if v.is_secret and not public.is_admin() then
    return 'null'::jsonb;
  end if;
  return v.value;
end;
$$;

create or replace function public.get_setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(public.get_setting(p_key) #>> '{}', '')::int,
    p_default
  )
$$;

create or replace function public.log_audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
end;
$$;

create or replace function public.notify(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

-- ============ Exactly one correct option per MCQ ============

-- A learner must not be able to read question_options (that table holds is_correct),
-- so any RLS policy that has to confirm an option belongs to a question has to ask
-- through a SECURITY DEFINER helper. A policy subquery is evaluated with the
-- caller's own permissions, which would make the check always fail for students.
create or replace function public.option_belongs_to_question(p_option_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.question_options qo
    where qo.id = p_option_id
      and qo.question_id = p_question_id
  );
$$;

create or replace function public.question_in_attempt(p_attempt_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.assessment_attempts a,
         lateral jsonb_array_elements_text(a.question_order) as qid(id)
    where a.id = p_attempt_id
      and qid.id::uuid = p_question_id
  );
$$;

create or replace function public.enforce_single_correct_option()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_correct then
    if exists (
      select 1 from public.question_options qo
      where qo.question_id = new.question_id
        and qo.is_correct
        and qo.id <> new.id
    ) then
      raise exception 'A question may have only one correct option (question %)', new.question_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_correct_option on public.question_options;
create trigger enforce_single_correct_option
  before insert or update on public.question_options
  for each row execute function public.enforce_single_correct_option();

-- ============ Lesson access and reading ============

create or replace function public.can_access_lesson(p_lesson_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_course_id uuid;
  v_status text;
begin
  select m.course_id, l.status
    into v_course_id, v_status
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    return false;
  end if;

  if public.is_course_staff(v_course_id) then
    return true;
  end if;

  if v_status <> 'published' then
    return false;
  end if;

  if not public.is_enrolled(v_course_id) then
    return false;
  end if;

  return not exists (
    select 1
    from public.lesson_prerequisites lp
    where lp.lesson_id = p_lesson_id
      and not exists (
        select 1 from public.lesson_progress lp2
        where lp2.lesson_id = lp.prerequisite_lesson_id
          and lp2.user_id = auth.uid()
          and lp2.status = 'completed'
      )
  );
end;
$$;

create or replace function public.record_reading_event(
  p_lesson_id uuid,
  p_pct int default 0,
  p_seconds int default 0,
  p_section_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_course_id uuid;
  v_required int;
  v_new_pct int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select m.course_id, l.required_reading_pct
    into v_course_id, v_required
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lesson not found';
  end if;

  if not public.is_enrolled(v_course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Lesson is not accessible yet';
  end if;

  insert into public.reading_events (user_id, lesson_id, section_id, pct, seconds)
  values (v_user_id, p_lesson_id, p_section_id, least(greatest(p_pct, 0), 100), greatest(p_seconds, 0));

  insert into public.lesson_progress (user_id, lesson_id, reading_pct, seconds_spent)
  values (v_user_id, p_lesson_id, least(greatest(p_pct, 0), 100), greatest(p_seconds, 0))
  on conflict (user_id, lesson_id) do update
    set reading_pct = greatest(public.lesson_progress.reading_pct, least(greatest(p_pct, 0), 100)),
        seconds_spent = public.lesson_progress.seconds_spent + greatest(p_seconds, 0),
        last_section_id = coalesce(p_section_id, public.lesson_progress.last_section_id),
        updated_at = now();

  select reading_pct into v_new_pct
  from public.lesson_progress
  where user_id = v_user_id and lesson_id = p_lesson_id;

  return jsonb_build_object('reading_pct', v_new_pct, 'required_pct', v_required);
end;
$$;

-- ============ Objective attempts ============

create or replace function public.start_objective_attempt(p_assessment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
  v_open_id uuid;
  v_count int;
  v_next int;
  v_attempt_id uuid;
  v_order jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into a from public.assessments where id = p_assessment_id and status = 'published';
  if not found then
    raise exception 'Assessment not found or not published';
  end if;

  if a.type = 'theory' then
    raise exception 'Theory examinations are started with create_theory_submission()';
  end if;

  if a.available_from is not null and now() < a.available_from then
    raise exception 'Assessment is not open yet';
  end if;
  if a.available_until is not null and now() > a.available_until then
    raise exception 'Assessment is closed';
  end if;

  if not public.is_enrolled(a.course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  select id into v_open_id
  from public.assessment_attempts
  where user_id = v_user_id and assessment_id = p_assessment_id and status = 'in_progress';

  if v_open_id is not null then
    return v_open_id;
  end if;

  if a.prerequisite = 'all_lessons' then
    if exists (
      select 1
      from public.lessons l
      join public.chapters ch on ch.id = l.chapter_id
      join public.modules m on m.id = ch.module_id
      where m.course_id = a.course_id
        and l.is_required
        and l.status = 'published'
        and not exists (
          select 1 from public.lesson_progress lp
          where lp.lesson_id = l.id and lp.user_id = v_user_id and lp.status = 'completed'
        )
    ) then
      raise exception 'All required lessons must be completed before starting this assessment';
    end if;
  end if;

  select count(*) into v_count
  from public.assessment_attempts
  where user_id = v_user_id and assessment_id = p_assessment_id;

  if a.max_attempts is not null and v_count >= a.max_attempts then
    raise exception 'Maximum number of attempts reached (%)', a.max_attempts;
  end if;

  v_next := v_count + 1;

  if a.randomize_questions then
    select coalesce(jsonb_agg(to_jsonb(s.id) order by s.rnd), '[]'::jsonb)
    into v_order
    from (
      select q.id, random() as rnd
      from public.questions q
      where q.assessment_id = p_assessment_id
        and q.status = 'published'
    ) s;
  else
    select coalesce(jsonb_agg(to_jsonb(q.id) order by q.position), '[]'::jsonb)
    into v_order
    from public.questions q
    where q.assessment_id = p_assessment_id and q.status = 'published';
  end if;

  if jsonb_array_length(v_order) = 0 then
    raise exception 'Assessment has no published questions';
  end if;

  insert into public.assessment_attempts (assessment_id, user_id, attempt_no, expires_at, question_order)
  values (
    p_assessment_id,
    v_user_id,
    v_next,
    case when a.duration_minutes is not null then now() + (a.duration_minutes || ' minutes')::interval end,
    v_order
  )
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

create or replace function public.submit_objective_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
  v_score numeric := 0;
  v_total numeric := 0;
  v_pct numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att
  from public.assessment_attempts
  where id = p_attempt_id and user_id = v_user_id;

  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.status <> 'in_progress' then
    raise exception 'Attempt is already submitted';
  end if;

  select * into a from public.assessments where id = att.assessment_id;

  if att.expires_at is not null and now() > att.expires_at then
    update public.assessment_attempts set status = 'expired', submitted_at = now() where id = p_attempt_id;
    raise exception 'Attempt has expired';
  end if;

  update public.attempt_answers aa
  set is_correct = coalesce(qo.is_correct, false)
  from public.question_options qo
  where qo.id = aa.selected_option_id
    and aa.attempt_id = p_attempt_id;

  update public.attempt_answers
  set is_correct = false
  where attempt_id = p_attempt_id
    and selected_option_id is null;

  select
    coalesce(sum(q.points), 0),
    coalesce(sum(case when aa.is_correct then q.points else 0 end), 0)
  into v_total, v_score
  from jsonb_array_elements_text(att.question_order) as ids(id)
  join public.questions q on q.id = ids.id::uuid
  left join public.attempt_answers aa on aa.attempt_id = p_attempt_id and aa.question_id = q.id;

  if v_total = 0 then
    v_pct := 0;
  else
    v_pct := round((v_score / v_total) * 100, 2);
  end if;

  update public.assessment_attempts
  set status = 'marked',
      submitted_at = now(),
      marked_at = now(),
      score = v_score,
      total = v_total,
      percentage = v_pct,
      passed = v_pct >= a.pass_mark
  where id = p_attempt_id;

  return jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'percentage', v_pct,
    'passed', v_pct >= a.pass_mark,
    'pass_mark', a.pass_mark
  );
end;
$$;

create or replace function public.best_objective_percentage(p_course_id uuid, p_user_id uuid default null)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select max(aa.percentage)
  from public.assessment_attempts aa
  join public.assessments a on a.id = aa.assessment_id
  where a.course_id = p_course_id
    and a.type = 'objective'
    and aa.user_id = coalesce(p_user_id, auth.uid())
    and aa.status = 'marked'
$$;

-- ============ Theory examination ============

create or replace function public.create_theory_submission(p_assessment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
  v_gate int;
  v_best numeric;
  v_open_id uuid;
  v_submission_id uuid;
  v_question record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into a from public.assessments where id = p_assessment_id and status = 'published';
  if not found then
    raise exception 'Assessment not found or not published';
  end if;
  if a.type <> 'theory' then
    raise exception 'Assessment is not a theory examination';
  end if;
  if not public.is_enrolled(a.course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  if a.available_from is not null and now() < a.available_from then
    raise exception 'Examination is not open yet';
  end if;

  v_gate := public.get_setting_int('theory_unlock_score', 70);
  v_best := coalesce(public.best_objective_percentage(a.course_id), 0);

  if v_best < v_gate then
    raise exception 'Theory examination unlocks at % percent on the objective assessment (best: %)', v_gate, v_best;
  end if;

  select id into v_open_id
  from public.theory_submissions
  where user_id = v_user_id and assessment_id = p_assessment_id and status = 'draft';

  if v_open_id is not null then
    return v_open_id;
  end if;

  if a.available_until is not null and now() > a.available_until then
    raise exception 'Examination is closed';
  end if;

  insert into public.theory_submissions (assessment_id, user_id, expires_at)
  values (
    p_assessment_id,
    v_user_id,
    case when a.duration_minutes is not null then now() + (a.duration_minutes || ' minutes')::interval end
  )
  returning id into v_submission_id;

  for v_question in
    select id from public.questions
    where assessment_id = p_assessment_id and status = 'published'
    order by position
  loop
    insert into public.theory_answers (submission_id, question_id, status)
    values (v_submission_id, v_question.id, 'not_selected');
  end loop;

  return v_submission_id;
end;
$$;

create or replace function public.select_theory_questions(
  p_submission_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  v_count int;
  v_valid int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s
  from public.theory_submissions
  where id = p_submission_id and user_id = v_user_id;

  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status <> 'draft' then
    raise exception 'Submission is not editable';
  end if;
  if coalesce(array_length(p_question_ids, 1), 0) <> 5 then
    raise exception 'You must select exactly 5 questions';
  end if;
  if (select count(distinct id) from unnest(p_question_ids) as id) <> 5 then
    raise exception 'Duplicate questions in selection';
  end if;

  select count(*) into v_valid
  from public.questions q
  where q.id = any (p_question_ids)
    and q.assessment_id = s.assessment_id;

  if v_valid <> 5 then
    raise exception 'Selection contains questions that are not part of this examination';
  end if;

  update public.theory_answers
  set status = case when question_id = any (p_question_ids) then 'draft' else 'not_selected' end,
      updated_at = now()
  where submission_id = p_submission_id;

  update public.theory_submissions
  set selected_question_ids = p_question_ids
  where id = p_submission_id;
end;
$$;

create or replace function public.submit_theory_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  v_selected int;
  v_empty int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s
  from public.theory_submissions
  where id = p_submission_id and user_id = v_user_id;

  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status <> 'draft' then
    raise exception 'Submission is not editable';
  end if;
  if s.expires_at is not null and now() > s.expires_at then
    update public.theory_submissions set status = 'submitted', submitted_at = now() where id = p_submission_id;
    raise exception 'Time has expired';
  end if;

  select count(*) into v_selected
  from public.theory_answers
  where submission_id = p_submission_id and status = 'draft';

  if v_selected <> 5 then
    raise exception 'You must answer exactly 5 questions (currently %)', v_selected;
  end if;

  select count(*) into v_empty
  from public.theory_answers
  where submission_id = p_submission_id and status = 'draft'
    and btrim(answer_text) = '';

  if v_empty > 0 then
    raise exception 'Every selected question needs an answer before submitting';
  end if;

  update public.theory_submissions
  set status = 'submitted',
      submitted_at = now(),
      selected_question_ids = coalesce(
        (select array_agg(question_id)
         from public.theory_answers
         where submission_id = p_submission_id and status = 'draft'),
        '{}'::uuid[]
      )
  where id = p_submission_id;
end;
$$;

create or replace function public.grade_theory_answer(
  p_theory_answer_id uuid,
  p_score numeric,
  p_feedback text default null,
  p_rubric_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid;
  v_total numeric;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to grade';
  end if;

  if p_score < 0 or p_score > 20 then
    raise exception 'Score must be between 0 and 20';
  end if;

  select submission_id into v_submission_id
  from public.theory_answers
  where id = p_theory_answer_id;

  if v_submission_id is null then
    raise exception 'Theory answer not found';
  end if;

  insert into public.theory_grades (theory_answer_id, score, feedback, graded_by, rubric_ref)
  values (p_theory_answer_id, p_score, p_feedback, auth.uid(), p_rubric_ref)
  on conflict (theory_answer_id) do update
    set score = excluded.score,
        feedback = excluded.feedback,
        graded_by = excluded.graded_by,
        rubric_ref = excluded.rubric_ref,
        graded_at = now();

  update public.theory_answers
  set status = 'graded', updated_at = now()
  where id = p_theory_answer_id;

  select coalesce(sum(g.score), 0)
  into v_total
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = v_submission_id;

  update public.theory_submissions
  set total_score = v_total,
      graded_at = now(),
      status = case
        when status in ('graded', 'released') then status
        else 'graded'
      end
  where id = v_submission_id;

  perform public.log_audit('theory.answer_graded', 'theory_answers', p_theory_answer_id::text, null, jsonb_build_object('score', p_score));
end;
$$;

create or replace function public.release_theory_grade(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_passed int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to release grades';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.status not in ('graded', 'released') then
    raise exception 'Submission must be graded before release';
  end if;

  v_passed := public.get_setting_int('theory_pass_mark', 50);

  update public.theory_submissions
  set status = 'released', released_at = now()
  where id = p_submission_id;

  perform public.notify(
    s.user_id,
    'grade_released',
    'Theory examination graded',
    case when coalesce(s.total_score, 0) >= v_passed then 'You passed.' else 'Result available in your assessment history.' end,
    '/dashboard/assessments'
  );

  perform public.log_audit('theory.released', 'theory_submissions', p_submission_id::text, null, null);
end;
$$;

-- ============ Progress, enrolment, certificate ============

create or replace function public.mark_lesson_complete(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_lesson record;
  v_progress record;
  v_course_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    l.id, l.chapter_id, l.kind, l.is_required, l.required_reading_pct,
    l.required_assessment_id, l.required_assessment_min_score, l.requires_approval,
    m.course_id
  into v_lesson
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where l.id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found';
  end if;

  v_course_id := v_lesson.course_id;

  if not public.is_enrolled(v_course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  if not public.can_access_lesson(p_lesson_id) then
    raise exception 'Complete the prerequisite lessons first';
  end if;

  select * into v_progress
  from public.lesson_progress
  where user_id = v_user_id and lesson_id = p_lesson_id;

  if v_progress is null then
    insert into public.lesson_progress (user_id, lesson_id)
    values (v_user_id, p_lesson_id)
    returning * into v_progress;
  end if;

  if v_lesson.requires_approval then
    raise exception 'This lesson requires instructor approval';
  end if;

  if v_lesson.kind = 'reading' and v_progress.reading_pct < v_lesson.required_reading_pct then
    raise exception 'Read at least % percent of the lesson before marking it complete (currently % percent)',
      v_lesson.required_reading_pct, v_progress.reading_pct;
  end if;

  if v_lesson.required_assessment_id is not null then
    if coalesce((
      select max(aa.percentage)
      from public.assessment_attempts aa
      where aa.assessment_id = v_lesson.required_assessment_id
        and aa.user_id = v_user_id
        and aa.status = 'marked'
    ), 0) < v_lesson.required_assessment_min_score then
      raise exception 'Pass the knowledge check for this lesson first (% percent required)', v_lesson.required_assessment_min_score;
    end if;
  end if;

  update public.lesson_progress
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      completed_by = 'self'
  where user_id = v_user_id and lesson_id = p_lesson_id;

  v_result := public.recompute_enrollment_progress(v_course_id, v_user_id);

  perform public.log_audit('lesson.completed', 'lessons', p_lesson_id::text, null, null);

  return v_result;
end;
$$;

create or replace function public.recompute_enrollment_progress(p_course_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total int;
  v_done int;
  v_pct numeric;
  v_theory_pass int;
  v_best_theory numeric;
  v_best_objective numeric;
  v_objective_pass int;
  v_result jsonb;
begin
  select count(*) into v_total
  from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where m.course_id = p_course_id
    and l.is_required
    and l.status = 'published';

  select count(*) into v_done
  from public.lesson_progress lp
  join public.lessons l on l.id = lp.lesson_id
  join public.chapters ch on ch.id = l.chapter_id
  join public.modules m on m.id = ch.module_id
  where m.course_id = p_course_id
    and lp.user_id = p_user_id
    and l.is_required
    and l.status = 'published'
    and lp.status = 'completed';

  v_pct := case when v_total = 0 then 0 else round((v_done::numeric / v_total) * 100, 2) end;

  update public.course_enrollments
  set progress_pct = v_pct,
      required_lessons_done = v_done,
      status = case when v_pct = 100 and status = 'active' then 'completed' else status end,
      completed_at = case when v_pct = 100 and completed_at is null then now() else completed_at end
  where course_id = p_course_id and user_id = p_user_id;

  v_theory_pass := public.get_setting_int('theory_pass_mark', 50);
  v_objective_pass := public.get_setting_int('objective_pass_mark', 50);

  select coalesce(max(ts.total_score), 0) into v_best_theory
  from public.theory_submissions ts
  where ts.assessment_id in (
      select id from public.assessments where course_id = p_course_id and type = 'theory'
    )
    and ts.user_id = p_user_id
    and ts.status in ('graded', 'released');

  v_best_objective := coalesce(public.best_objective_percentage(p_course_id, p_user_id), 0);

  v_result := jsonb_build_object(
    'progress_pct', v_pct,
    'required_lessons_done', v_done,
    'required_lessons_total', v_total,
    'objective_best', v_best_objective,
    'theory_best', coalesce(v_best_theory, 0)
  );

  if v_pct = 100
     and v_best_objective >= v_objective_pass
     and coalesce(v_best_theory, 0) >= v_theory_pass then
    v_result := v_result || jsonb_build_object('certificate_eligible', true);
    perform public.issue_certificate(p_user_id, p_course_id, false);
  end if;

  return v_result;
end;
$$;

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

  return jsonb_build_object(
    'eligible', v_total = v_done and v_total > 0 and v_objective >= v_objective_pass and coalesce(v_theory, 0) >= v_theory_pass,
    'lessons', jsonb_build_object('done', v_done, 'total', v_total),
    'objective', jsonb_build_object('best', v_objective, 'pass_mark', v_objective_pass),
    'theory', jsonb_build_object('best', coalesce(v_theory, 0), 'pass_mark', v_theory_pass)
  );
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
declare
  v_eligibility jsonb;
  v_id uuid;
  v_number text;
begin
  if not p_force and not public.is_course_staff(p_course_id) and p_user_id <> auth.uid() then
    raise exception 'Not authorised to issue certificates';
  end if;

  if p_force and not public.is_admin() then
    raise exception 'Only administrators can force certificate issuance';
  end if;

  select id into v_id
  from public.certificates
  where user_id = p_user_id and course_id = p_course_id and status = 'issued';

  if v_id is not null then
    return v_id;
  end if;

  v_eligibility := public.certificate_eligible(p_user_id, p_course_id);

  if not (v_eligibility ->> 'eligible')::boolean and not p_force then
    raise exception 'Completion criteria are not met: %', v_eligibility;
  end if;

  v_number := 'LIS815-' || to_char(now(), 'YYYY') || '-' ||
    upper(substring(md5(p_user_id::text || p_course_id::text || now()::text) for 8));

  insert into public.certificates (user_id, course_id, certificate_number, eligibility_snapshot, issued_by)
  values (p_user_id, p_course_id, v_number, v_eligibility, auth.uid())
  returning id into v_id;

  perform public.notify(
    p_user_id,
    'certificate_issued',
    'Certificate of completion issued',
    'Your LIS 815 certificate is ready to download.',
    '/dashboard/certificate'
  );

  perform public.log_audit('certificate.issued', 'certificates', v_number, null, v_eligibility);

  return v_id;
end;
$$;

-- ============ Enrolment ============

create or replace function public.enroll_self(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  c record;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into c from public.courses where id = p_course_id and status = 'published' and deleted_at is null;
  if not found then
    raise exception 'Course not available';
  end if;
  if not c.enrolment_open then
    raise exception 'Enrolment is closed';
  end if;

  insert into public.course_enrollments (course_id, user_id)
  values (p_course_id, v_user_id)
  on conflict (course_id, user_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.course_enrollments where course_id = p_course_id and user_id = v_user_id;
  end if;

  return v_id;
end;
$$;

-- ============ Question delivery (students never read questions/options tables directly) ============

create or replace function public.get_attempt_snapshot(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.user_id <> v_user_id and not public.is_course_staff(public.course_of_assessment(att.assessment_id)) then
    raise exception 'Not authorised to view this attempt';
  end if;

  select * into a from public.assessments where id = att.assessment_id;

  return jsonb_build_object(
    'attempt_id', att.id,
    'assessment_id', att.assessment_id,
    'status', att.status,
    'attempt_no', att.attempt_no,
    'started_at', att.started_at,
    'expires_at', att.expires_at,
    'duration_minutes', a.duration_minutes,
    'randomize_options', a.randomize_options,
    'question_order', att.question_order,
    'questions', (
      select coalesce(jsonb_agg(s.q_json order by s.ord), '[]'::jsonb)
      from (
        select
          ids.ord,
          jsonb_build_object(
            'id', q.id,
            'stem_md', q.stem_md,
            'points', q.points,
            'type', q.type,
            'options', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text)
                  order by o.position, o.label
                ),
                '[]'::jsonb
              )
              from public.question_options o
              where o.question_id = q.id
            )
          ) as q_json
        from jsonb_array_elements_text(att.question_order) with ordinality as ids(id, ord)
        join public.questions q on q.id = ids.id::uuid
      ) s
    )
  );
end;
$$;

create or replace function public.get_attempt_results(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  a record;
  v_staff boolean;
  v_allow_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  v_staff := public.is_course_staff(public.course_of_assessment(att.assessment_id));

  if att.user_id <> v_user_id and not v_staff then
    raise exception 'Not authorised to view this attempt';
  end if;

  if att.status <> 'marked' and not v_staff then
    raise exception 'Results are not available yet';
  end if;

  select * into a from public.assessments where id = att.assessment_id;
  v_allow_correct := coalesce(a.show_correct_answers, true) or v_staff;

  return jsonb_build_object(
    'attempt_id', att.id,
    'status', att.status,
    'score', att.score,
    'total', att.total,
    'percentage', att.percentage,
    'passed', att.passed,
    'pass_mark', a.pass_mark,
    'show_correct_answers', v_allow_correct,
    'questions', (
      select coalesce(jsonb_agg(s.q_json order by s.ord), '[]'::jsonb)
      from (
        select
          ids.ord,
          jsonb_build_object(
            'id', q.id,
            'stem_md', q.stem_md,
            'points', q.points,
            'selected_option_id', aa.selected_option_id,
            'is_correct', aa.is_correct,
            'correct_option_id', case when v_allow_correct then co.id else null end,
            'correct_option_label', case when v_allow_correct then co.label else null end,
            'explanation_md', case when v_allow_correct then q.explanation_md else null end,
            'options', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object('id', o.id, 'label', o.label, 'text', o.text)
                  order by o.position, o.label
                ),
                '[]'::jsonb
              )
              from public.question_options o
              where o.question_id = q.id
            )
          ) as q_json
        from jsonb_array_elements_text(att.question_order) with ordinality as ids(id, ord)
        join public.questions q on q.id = ids.id::uuid
        left join public.attempt_answers aa
          on aa.attempt_id = att.id and aa.question_id = q.id
        left join public.question_options co
          on co.question_id = q.id and co.is_correct
      ) s
    )
  );
end;
$$;

create or replace function public.get_theory_questions(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into a from public.assessments where id = p_assessment_id;
  if not found then
    raise exception 'Assessment not found';
  end if;

  if a.type <> 'theory' then
    raise exception 'Assessment is not a theory examination';
  end if;

  if a.status <> 'published' then
    if not public.is_course_staff(a.course_id) then
      raise exception 'Examination is not published';
    end if;
  elsif not public.is_enrolled(a.course_id) and not public.is_course_staff(a.course_id) then
    raise exception 'Not enrolled in this course';
  end if;

  return jsonb_build_object(
    'assessment_id', a.id,
    'title', a.title,
    'duration_minutes', a.duration_minutes,
    'available_from', a.available_from,
    'available_until', a.available_until,
    'questions', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'position', q.position,
            'stem_md', q.stem_md,
            'points', q.points
          )
          order by q.position
        ),
        '[]'::jsonb
      )
      from public.questions q
      where q.assessment_id = p_assessment_id
        and q.status = 'published'
    )
  );
end;
$$;
