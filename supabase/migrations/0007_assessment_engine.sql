-- LIS 815 LMS — 0007_assessment_engine.sql
-- Phase 6: the writes and reads the assessment engine needs.
--   * mark_attempt_internal()  - one place that marks an attempt from saved answers
--   * save_answer()            - expiry-checked answer upsert (is_correct stays server-side)
--   * assessment_centre()      - one call that powers the assessment centre page
--   * theory_eligibility()     - the 70% gate, with a plain-English reason
--   * submit_objective_attempt - now marks what was saved when time runs out
--   * get_attempt_results      - a timed-out attempt still returns its score
-- Idempotent: safe to re-run.

-- ============ User-scoped copies of the two access helpers ============
-- is_enrolled() and is_course_staff() answer for the *caller*. Staff need the same
-- answers for the learner in front of them, and theory_eligibility(p_course_id,
-- p_user_id) promises exactly that, so these take the user explicitly.

create or replace function public.is_enrolled_for(p_course_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.course_enrollments ce
    where ce.course_id = p_course_id
      and ce.user_id = p_user_id
      and ce.status in ('active', 'completed')
  )
$$;

create or replace function public.is_course_staff_for(p_course_id uuid, p_user_id uuid)
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
    where ur.user_id = p_user_id
      and r.code in ('admin', 'superadmin')
  )
  or exists (
    select 1 from public.course_staff cs
    where cs.course_id = p_course_id
      and cs.user_id = p_user_id
  )
$$;

-- ============ Marking ============

-- Marks an attempt from the answers already saved. p_final_status is 'marked' for a
-- normal submission and 'expired' when the clock ran out, so the learner can still see
-- the score for the answers the server accepted.
create or replace function public.mark_attempt_internal(p_attempt_id uuid, p_final_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  att record;
  a record;
  v_score numeric := 0;
  v_total numeric := 0;
  v_pct numeric := 0;
begin
  select * into att from public.assessment_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt not found';
  end if;

  if att.status not in ('in_progress', 'submitted', 'expired') then
    return null; -- already marked; marking twice must not change the score
  end if;

  select * into a from public.assessments where id = att.assessment_id;

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

  if v_total > 0 then
    v_pct := round((v_score / v_total) * 100, 2);
  end if;

  update public.assessment_attempts
  set status = p_final_status,
      submitted_at = coalesce(submitted_at, now()),
      marked_at = now(),
      score = v_score,
      total = v_total,
      percentage = v_pct,
      passed = v_pct >= a.pass_mark
  where id = p_attempt_id;

  if p_final_status = 'marked' then
    perform public.notify(
      att.user_id,
      'objective_marked',
      a.title || ' result',
      case when v_pct >= a.pass_mark
        then 'You scored ' || v_pct || '%. Passed.'
        else 'You scored ' || v_pct || '%. The pass mark is ' || a.pass_mark || '%.'
      end,
      '/dashboard/assessments/' || a.id
    );
  end if;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'score', v_score,
    'total', v_total,
    'percentage', v_pct,
    'passed', v_pct >= a.pass_mark,
    'pass_mark', a.pass_mark,
    'expired', p_final_status = 'expired'
  );
end;
$$;

-- ============ Saving one answer ============

-- The exam runner calls this on every change. It never touches is_correct.
-- Once the clock has run out it does NOT raise: an exception would roll back the
-- marking that has to survive, so it marks the attempt and returns expired = true for
-- the runner to act on. A closed (already marked) attempt is refused loudly, because
-- there is no work left for the server to do.
create or replace function public.save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  v_marked jsonb;
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

  if att.status not in ('in_progress', 'expired') then
    raise exception 'This attempt is closed';
  end if;

  if att.expires_at is not null and now() > att.expires_at then
    v_marked := public.mark_attempt_internal(p_attempt_id, 'expired');
    return v_marked || jsonb_build_object(
      'question_id', p_question_id,
      'saved', false,
      'status', 'expired',
      'reason', 'Time is up. Your saved answers have been marked.'
    );
  end if;

  if not public.question_in_attempt(p_attempt_id, p_question_id) then
    raise exception 'That question is not part of this attempt';
  end if;

  if p_selected_option_id is not null
     and not public.option_belongs_to_question(p_selected_option_id, p_question_id) then
    raise exception 'That option does not belong to this question';
  end if;

  insert into public.attempt_answers (attempt_id, question_id, selected_option_id, answered_at)
  values (p_attempt_id, p_question_id, p_selected_option_id, now())
  on conflict (attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        answered_at = now(),
        updated_at = now()
    where public.attempt_answers.selected_option_id is distinct from excluded.selected_option_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'question_id', p_question_id,
    'selected_option_id', p_selected_option_id,
    'saved', true,
    'status', 'in_progress',
    'saved_at', now(),
    'expires_at', att.expires_at
  );
end;
$$;

-- ============ Assessment centre ============

-- Everything the centre page needs in one call: the published assessments, how many
-- questions each holds (students may not read the questions table), the learner's own
-- attempts, and the best score so far.
create or replace function public.assessment_centre(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_enrolled boolean;
  v_staff boolean;
  v_lessons_done int := 0;
  v_lessons_total int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_enrolled := public.is_enrolled_for(p_course_id, v_user_id);
  v_staff := public.is_course_staff_for(p_course_id, v_user_id);

  if not v_enrolled and not v_staff then
    raise exception 'Not enrolled in this course';
  end if;

  select
    count(*) filter (where l.is_required and l.status = 'published'),
    count(*) filter (where l.is_required and l.status = 'published' and lp.status = 'completed')
  into v_lessons_total, v_lessons_done
  from public.modules m
  join public.chapters c on c.module_id = m.id
  join public.lessons l on l.chapter_id = c.id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_user_id
  where m.course_id = p_course_id;

  return jsonb_build_object(
    'enrolled', v_enrolled,
    'required_lessons_total', v_lessons_total,
    'required_lessons_done', v_lessons_done,
    'assessments', (
      select coalesce(jsonb_agg(s.a_json order by s.ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by a.type, a.created_at) as ord,
          jsonb_build_object(
            'id', a.id,
            'type', a.type,
            'title', a.title,
            'description', a.description,
            'duration_minutes', a.duration_minutes,
            'max_attempts', a.max_attempts,
            'pass_mark', a.pass_mark,
            'randomize_questions', a.randomize_questions,
            'randomize_options', a.randomize_options,
            'show_correct_answers', a.show_correct_answers,
            'available_from', a.available_from,
            'available_until', a.available_until,
            'prerequisite', a.prerequisite,
            'settings', a.settings,
            'question_count', (
              select count(*)::int from public.questions q
              where q.assessment_id = a.id and q.status = 'published'
            ),
            'attempts', (
              select coalesce(jsonb_agg(t.t_json order by t.attempt_no), '[]'::jsonb)
              from (
                select
                  at.attempt_no,
                  jsonb_build_object(
                    'id', at.id,
                    'attempt_no', at.attempt_no,
                    'status', at.status,
                    'started_at', at.started_at,
                    'expires_at', at.expires_at,
                    'submitted_at', at.submitted_at,
                    'score', at.score,
                    'total', at.total,
                    'percentage', at.percentage,
                    'passed', at.passed,
                    'answered', (
                      select count(*)::int from public.attempt_answers aa
                      where aa.attempt_id = at.id
                    )
                  ) as t_json
                from public.assessment_attempts at
                where at.assessment_id = a.id and at.user_id = v_user_id
              ) t
            )
          ) as a_json
        from public.assessments a
        where a.course_id = p_course_id
          and a.status = 'published'
          and (a.available_from is null or a.available_from <= now() or v_staff)
      ) s
    )
  );
end;
$$;

-- ============ The 70% gate ============

-- Four states the theory section shows, each with a reason a learner can act on:
--   not_enrolled | not_attempted | below_threshold | eligible
-- Required-lesson gating is enforced earlier, by start_objective_attempt()'s own
-- 'all_lessons' prerequisite, so it is reported here for context but not gated on.
create or replace function public.theory_eligibility(p_course_id uuid, p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := coalesce(p_user_id, auth.uid());
  v_threshold int;
  v_best numeric;
  v_lessons_done int := 0;
  v_lessons_total int := 0;
  v_attempts int := 0;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  v_threshold := coalesce(public.get_setting_int('theory_unlock_score', 70), 70);

  select
    count(*) filter (where l.is_required and l.status = 'published'),
    count(*) filter (where l.is_required and l.status = 'published' and lp.status = 'completed')
  into v_lessons_total, v_lessons_done
  from public.modules m
  join public.chapters c on c.module_id = m.id
  join public.lessons l on l.chapter_id = c.id
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_user
  where m.course_id = p_course_id;

  select count(*) into v_attempts
  from public.assessment_attempts aa
  join public.assessments a on a.id = aa.assessment_id
  where a.course_id = p_course_id and a.type = 'objective' and aa.user_id = v_user;

  v_best := public.best_objective_percentage(p_course_id, v_user);

  return jsonb_build_object(
    'state', case
      when not public.is_enrolled_for(p_course_id, v_user)
           and not public.is_course_staff_for(p_course_id, v_user)
        then 'not_enrolled'
      when v_best >= v_threshold then 'eligible'
      when v_attempts = 0 then 'not_attempted'
      else 'below_threshold'
    end,
    'threshold', v_threshold,
    'best_percentage', v_best,
    'attempt_count', v_attempts,
    'required_lessons_total', v_lessons_total,
    'required_lessons_done', v_lessons_done,
    'reason', case
      when not public.is_enrolled_for(p_course_id, v_user)
           and not public.is_course_staff_for(p_course_id, v_user)
        then 'Enrol in the course to sit the theory examination.'
      when v_best >= v_threshold
        then 'You reached ' || v_threshold || ' percent on the objective assessment, so the theory examination is open.'
      when v_attempts = 0
        then 'Sit the objective assessment first. The theory examination opens at ' || v_threshold || ' percent.'
      else 'The theory examination opens at ' || v_threshold || ' percent on the objective assessment. Your best score is ' || round(v_best)::int || ' percent.'
    end
  );
end;
$$;

-- ============ Submission now scores a timed-out attempt ============

create or replace function public.submit_objective_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  att record;
  v_result jsonb;
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
    -- Submitting twice must never produce a second score.
    if att.status in ('marked', 'expired') then
      return jsonb_build_object(
        'attempt_id', att.id,
        'score', att.score,
        'total', att.total,
        'percentage', att.percentage,
        'passed', att.passed,
        'already_submitted', true,
        'expired', att.status = 'expired'
      );
    end if;
    raise exception 'Attempt is already submitted';
  end if;

  if att.expires_at is not null and now() > att.expires_at then
    v_result := public.mark_attempt_internal(p_attempt_id, 'expired');
    v_result := v_result || jsonb_build_object('already_submitted', false);
    return v_result;
  end if;

  v_result := public.mark_attempt_internal(p_attempt_id, 'marked');
  return v_result || jsonb_build_object('already_submitted', false);
end;
$$;

-- ============ Results for a timed-out attempt ============

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

  if att.status not in ('marked', 'expired') and not v_staff then
    raise exception 'Results are not available yet';
  end if;

  select * into a from public.assessments where id = att.assessment_id;
  v_allow_correct := coalesce(a.show_correct_answers, true) or v_staff;

  return jsonb_build_object(
    'attempt_id', att.id,
    'assessment_id', att.assessment_id,
    'assessment_title', a.title,
    'pass_mark', a.pass_mark,
    'status', att.status,
    'expired', att.status = 'expired',
    'attempt_no', att.attempt_no,
    'score', att.score,
    'total', att.total,
    'percentage', att.percentage,
    'passed', att.passed,
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
            'chapter_id', q.chapter_id,
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

-- ============ Resume support ============
-- The runner must survive a reload: without the saved choices a reopened exam would
-- look unanswered, and a reload after submitting would look like a live paper. This
-- adds the saved selections, the counts, and the rules the runner needs to behave.
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
    'title', a.title,
    'pass_mark', a.pass_mark,
    'status', att.status,
    'attempt_no', att.attempt_no,
    'started_at', att.started_at,
    'expires_at', att.expires_at,
    'duration_minutes', a.duration_minutes,
    'randomize_options', a.randomize_options,
    'show_correct_answers', a.show_correct_answers,
    'question_order', att.question_order,
    'question_count', jsonb_array_length(att.question_order),
    'answered_count', (
      select count(*)::int from public.attempt_answers aa
      where aa.attempt_id = att.id and aa.selected_option_id is not null
    ),
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
            'selected_option_id', aa.selected_option_id,
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
      ) s
    )
  );
end;
$$;

-- ============ Grants ============
-- PostgREST only exposes functions to roles that hold EXECUTE.
grant execute on function public.mark_attempt_internal(uuid, text) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.assessment_centre(uuid) to authenticated;
grant execute on function public.theory_eligibility(uuid, uuid) to authenticated;
grant execute on function public.is_enrolled_for(uuid, uuid) to authenticated;
grant execute on function public.is_course_staff_for(uuid, uuid) to authenticated;

-- Learners should not be able to close their own attempt by writing the row directly.
drop policy if exists assessment_attempts_write on public.assessment_attempts;
create policy assessment_attempts_write on public.assessment_attempts
  for update to authenticated
  using (user_id = auth.uid() and status = 'in_progress')
  with check (user_id = auth.uid());
