-- LIS 815 LMS — 0008_theory_exam.sql
-- Phase 7: the parts of the 5-of-7 theory examination the earlier migrations left out.
--   * save_theory_answer()          - autosave with a word count, expiry reported not raised
--   * submit_theory_submission()    - the clock no longer rolls the closure back
--   * enforce_theory_submission_rules() - the exactly-5 rule as a trigger, not just an RPC
--   * get_theory_workspace()        - the learner's own view (never a model answer)
--   * theory_grading_queue()        - staff queue of papers that are actually in for marking
--   * get_theory_grading_view()     - staff view WITH model answers, behind the grade permission
--   * get_theory_result()           - the released result, model answers never included
--   * claim_theory_submission()     - draft -> submitted -> under_review -> graded -> released
--   * grade_theory_answer()         - refuses drafts, records before/after on a re-grade
--   * set_theory_overall_feedback() - overall comments without touching release's signature
--
-- Every function here keeps the signature it already had in 0002, because
-- "create or replace" cannot change a return type and each file has to stay
-- re-appliable on its own.
--
-- Idempotent: safe to re-run.

-- The word count on the paper is derived, so it lives on the row the trigger fills in.
alter table public.theory_submissions
  add column if not exists total_words int not null default 0 check (total_words >= 0);

-- ============ Autosave ============

create or replace function public.save_theory_answer(p_answer_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  a record;
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select ta.*, sub.status as submission_status, sub.expires_at as expires_at
  into a
  from public.theory_answers ta
  join public.theory_submissions sub on sub.id = ta.submission_id
  where ta.id = p_answer_id and sub.user_id = v_user_id;

  if not found then
    raise exception 'Answer not found';
  end if;

  if a.status = 'not_selected' then
    raise exception 'Select this question before writing an answer';
  end if;

  if a.submission_status <> 'draft' then
    raise exception 'This submission is locked and can no longer be edited';
  end if;

  -- The same rule as the objective paper: report the expiry, do not raise, because a
  -- raise would roll back the submission we are about to close.
  if a.expires_at is not null and now() > a.expires_at then
    update public.theory_submissions
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = a.submission_id and status = 'draft';

    return jsonb_build_object(
      'answer_id', p_answer_id,
      'saved', false,
      'expired', true,
      'status', 'submitted',
      'reason', 'Time is up. What you had written has been submitted for marking.'
    );
  end if;

  v_count := case
    when trim(coalesce(p_text, '')) = '' then 0
    else array_length(regexp_split_to_array(trim(coalesce(p_text, '')), '\s+'), 1)
  end;

  update public.theory_answers
  set answer_text = coalesce(p_text, ''),
      word_count = greatest(v_count, 0),
      updated_at = now()
  where id = p_answer_id;

  return jsonb_build_object(
    'answer_id', p_answer_id,
    'saved', true,
    'expired', false,
    'status', 'draft',
    'word_count', greatest(v_count, 0),
    'saved_at', now()
  );
end;
$$;

-- ============ The exactly-5 rule as a trigger ============
-- The RPCs enforce it; this enforces it for every other route into the table, so a
-- direct write cannot produce a submitted paper with four answers. It also owns the
-- derived columns (which five, how long, when it closed) so every closure path fills
-- them in the same way.
--
-- Out of time is the one exception: a paper that ran out of the clock is closed with
-- whatever was written, because refusing to close it would strand the learner with a
-- draft that can never be marked.

create or replace function public.enforce_theory_submission_rules()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_selected int;
  v_empty int;
  v_out_of_time boolean;
begin
  if new.status is distinct from 'submitted' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submitted' then
    return new; -- already closed; grading and release are not affected
  end if;

  v_out_of_time := new.expires_at is not null and now() > new.expires_at;

  select
    count(*) filter (where ta.status <> 'not_selected'),
    count(*) filter (where ta.status <> 'not_selected' and btrim(ta.answer_text) = ''),
    coalesce(sum(ta.word_count) filter (where ta.status <> 'not_selected'), 0)
  into v_selected, v_empty, new.total_words
  from public.theory_answers ta
  where ta.submission_id = new.id;

  if not v_out_of_time then
    if v_selected <> 5 then
      raise exception 'A submitted theory paper must answer exactly 5 questions (found %)', v_selected;
    end if;
    if v_empty > 0 then
      raise exception 'A submitted theory paper cannot contain an empty answer';
    end if;
  end if;

  new.selected_question_ids := coalesce(
    (select array_agg(ta.question_id order by ta.question_id)
     from public.theory_answers ta
     where ta.submission_id = new.id and ta.status <> 'not_selected'),
    '{}'::uuid[]
  );
  new.submitted_at := coalesce(new.submitted_at, now());
  return new;
end;
$$;

drop trigger if exists enforce_theory_submission_rules on public.theory_submissions;
create trigger enforce_theory_submission_rules
  before insert or update of status on public.theory_submissions
  for each row execute function public.enforce_theory_submission_rules();

-- ============ Submission ============
-- The earlier version raised on expiry, which discarded the very update that closed the
-- paper and left the learner with a draft that could never be submitted. The clock is
-- reported through save_theory_answer() and the runner's own countdown; here the paper
-- is simply closed. selected_question_ids, submitted_at and total_words are filled in by
-- the trigger, on this path and on every other one.

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

  -- Already closed, including by save_theory_answer() when the clock ran out.
  if s.status <> 'draft' then
    return;
  end if;

  -- Out of time: the trigger allows this, and closes the paper as it stands.
  if s.expires_at is not null and now() > s.expires_at then
    update public.theory_submissions
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = p_submission_id;
    return;
  end if;

  select
    count(*),
    count(*) filter (where btrim(answer_text) = '')
  into v_selected, v_empty
  from public.theory_answers
  where submission_id = p_submission_id and status = 'draft';

  if v_selected <> 5 then
    raise exception 'You must answer exactly 5 questions (currently %)', v_selected;
  end if;

  if v_empty > 0 then
    raise exception 'Every selected question needs an answer before submitting';
  end if;

  update public.theory_submissions
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_submission_id;
end;
$$;

-- ============ The learner's workspace ============

create or replace function public.get_theory_workspace(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  a record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.user_id <> v_user_id
     and not public.is_course_staff_for(public.course_of_submission(s.id), v_user_id) then
    raise exception 'Not authorised to view this submission';
  end if;

  select * into a from public.assessments where id = s.assessment_id;

  return jsonb_build_object(
    'submission_id', s.id,
    'assessment_id', a.id,
    'course_id', a.course_id,
    'title', a.title,
    'description', a.description,
    'instructions', a.settings -> 'instructions',
    'pass_mark', a.pass_mark,
    'marks_each', coalesce((a.settings ->> 'marks_each')::int, 20),
    'duration_minutes', a.duration_minutes,
    'status', s.status,
    'total_words', s.total_words,
    'started_at', s.started_at,
    'expires_at', s.expires_at,
    'submitted_at', s.submitted_at,
    'graded_at', s.graded_at,
    'released_at', s.released_at,
    'total_score', s.total_score,
    'overall_feedback', s.overall_feedback,
    'is_staff_view', s.user_id <> v_user_id,
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'position', q.position,
          'stem_md', q.stem_md,
          'points', q.points,
          'module_title', m.title,
          'chapter_title', ch.title,
          'selected', ta.status <> 'not_selected',
          'answer_text', ta.answer_text,
          'word_count', ta.word_count,
          'answer_status', ta.status,
          'answer_id', ta.id
        ) order by q.position
      ), '[]'::jsonb)
      from public.questions q
      join public.theory_answers ta
        on ta.question_id = q.id and ta.submission_id = s.id
      left join public.chapters ch on ch.id = q.chapter_id
      left join public.modules m on m.id = ch.module_id
      where q.assessment_id = a.id and q.status = 'published'
    )
  );
end;
$$;

-- ============ Staff: the grading queue ============
-- A draft is not work. It is a paper nobody has handed in yet, and leaving it in the
-- queue meant staff could "grade" a learner's unfinished thinking.

create or replace function public.theory_grading_queue(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff boolean;
  v_pass int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  v_staff := public.is_course_staff_for(p_course_id, v_user_id);
  if not v_staff then
    raise exception 'Not authorised to view the grading queue';
  end if;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);

  return jsonb_build_object(
    'pass_mark', v_pass,
    'submissions', (
      select coalesce(jsonb_agg(s.s_json order by
        case s.status when 'submitted' then 0 when 'under_review' then 1 else 2 end,
        s.submitted_at nulls last
      ), '[]'::jsonb)
      from (
        select
          ts.status as status,
          ts.submitted_at as submitted_at,
          jsonb_build_object(
            'id', ts.id,
            'user_id', ts.user_id,
            'learner_name', nullif(trim(coalesce(p.full_name, '')), ''),
            'learner_email', p.email,
            'status', ts.status,
            'total_words', ts.total_words,
            'started_at', ts.started_at,
            'expires_at', ts.expires_at,
            'submitted_at', ts.submitted_at,
            'graded_at', ts.graded_at,
            'released_at', ts.released_at,
            'total_score', ts.total_score,
            'graded_count', (
              select count(*)::int
              from public.theory_grades g
              join public.theory_answers ta on ta.id = g.theory_answer_id
              where ta.submission_id = ts.id
            ),
            'answer_count', (
              select count(*)::int
              from public.theory_answers ta
              where ta.submission_id = ts.id and ta.status <> 'not_selected'
            )
          ) as s_json
        from public.theory_submissions ts
        join public.profiles p on p.id = ts.user_id
        where public.course_of_submission(ts.id) = p_course_id
          and ts.status <> 'draft'
      ) s
    )
  );
end;
$$;

-- ============ Staff: one paper to mark ============

create or replace function public.get_theory_grading_view(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  a record;
  v_learner record;
  v_course_id uuid;
  v_pass int;
  v_marks_each int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  v_course_id := public.course_of_submission(s.id);
  if not public.is_course_staff_for(v_course_id, v_user_id)
     or not public.has_permission('assessment.grade') then
    raise exception 'Not authorised to grade this submission';
  end if;

  select * into a from public.assessments where id = s.assessment_id;
  select * into v_learner from public.profiles where id = s.user_id;

  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);
  v_marks_each := coalesce((a.settings ->> 'marks_each')::int, 20);

  return jsonb_build_object(
    'submission_id', s.id,
    'assessment_id', a.id,
    'course_id', v_course_id,
    'title', a.title,
    'status', s.status,
    'learner', jsonb_build_object(
      'id', s.user_id,
      'name', v_learner.full_name,
      'email', v_learner.email
    ),
    'total_words', s.total_words,
    'started_at', s.started_at,
    'expires_at', s.expires_at,
    'submitted_at', s.submitted_at,
    'graded_at', s.graded_at,
    'released_at', s.released_at,
    'total_score', s.total_score,
    'max_score', v_marks_each * 5,
    'pass_mark', v_pass,
    'overall_feedback', s.overall_feedback,
    'marks_each', v_marks_each,
    'model_answer_caveat', 'Model answers are indicative and not exhaustive. They show the expected shape of a good answer, not the only acceptable one. Award credit for any sound, well-evidenced response.',
    'answers', (
      select coalesce(jsonb_agg(s2.a_json order by s2.ord), '[]'::jsonb)
      from (
        select
          q.position as ord,
          jsonb_build_object(
            'answer_id', ta.id,
            'question_id', q.id,
            'position', q.position,
            'stem_md', q.stem_md,
            'points', q.points,
            'source_ref', q.source_ref,
            'module_title', m.title,
            'chapter_title', ch.title,
            'answer_text', ta.answer_text,
            'word_count', ta.word_count,
            'model_answer_md', q.model_answer_md,
            'score', g.score,
            'feedback', g.feedback,
            'rubric_ref', g.rubric_ref,
            'graded_at', g.graded_at
          ) as a_json
        from public.theory_answers ta
        join public.questions q on q.id = ta.question_id
        left join public.theory_grades g on g.theory_answer_id = ta.id
        left join public.chapters ch on ch.id = q.chapter_id
        left join public.modules m on m.id = ch.module_id
        where ta.submission_id = s.id and ta.status <> 'not_selected'
      ) s2
    )
  );
end;
$$;

-- ============ The learner: the released result ============

create or replace function public.get_theory_result(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
  a record;
  v_pass int;
  v_marks_each int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if s.user_id <> v_user_id
     and not public.is_course_staff_for(public.course_of_submission(s.id), v_user_id) then
    raise exception 'Not authorised to view this submission';
  end if;
  if s.status <> 'released' then
    raise exception 'Your result has not been released yet';
  end if;

  select * into a from public.assessments where id = s.assessment_id;
  v_pass := coalesce(public.get_setting_int('theory_pass_mark', 50), 50);
  v_marks_each := coalesce((a.settings ->> 'marks_each')::int, 20);

  return jsonb_build_object(
    'submission_id', s.id,
    'course_id', a.course_id,
    'title', a.title,
    'status', s.status,
    'total_words', s.total_words,
    'submitted_at', s.submitted_at,
    'graded_at', s.graded_at,
    'released_at', s.released_at,
    'total_score', s.total_score,
    'max_score', v_marks_each * 5,
    'pass_mark', v_pass,
    'passed', coalesce(s.total_score, 0) >= v_pass,
    'overall_feedback', s.overall_feedback,
    'answers', (
      select coalesce(jsonb_agg(s2.a_json order by s2.ord), '[]'::jsonb)
      from (
        select
          q.position as ord,
          jsonb_build_object(
            'position', q.position,
            'stem_md', q.stem_md,
            'points', q.points,
            'source_ref', q.source_ref,
            'answer_text', ta.answer_text,
            'word_count', ta.word_count,
            'score', g.score,
            'max_score', coalesce((a.settings ->> 'marks_each')::int, 20),
            'feedback', g.feedback,
            'rubric_ref', g.rubric_ref
          ) as a_json
        from public.theory_answers ta
        join public.questions q on q.id = ta.question_id
        left join public.theory_grades g on g.theory_answer_id = ta.id
        where ta.submission_id = s.id and ta.status <> 'not_selected'
      ) s2
    )
  );
end;
$$;

-- ============ Claiming a paper for marking ============

create or replace function public.claim_theory_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  s record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if not public.is_course_staff_for(public.course_of_submission(s.id), v_user_id) then
    raise exception 'Not authorised to claim this submission';
  end if;
  if s.status not in ('submitted', 'under_review') then
    raise exception 'Only a submitted paper can be claimed';
  end if;

  update public.theory_submissions
  set status = 'under_review', graded_by = v_user_id, updated_at = now()
  where id = p_submission_id
    and (graded_by is null or graded_by = v_user_id or status = 'submitted');

  perform public.log_audit(
    'theory.claimed', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('by', v_user_id)
  );

  return jsonb_build_object('submission_id', p_submission_id, 'status', 'under_review');
end;
$$;

-- ============ Grading, with before/after on a re-grade ============
-- Two real gaps in the earlier version: it could mark a paper that was still a draft,
-- and a re-grade overwrote the score with nothing in the audit log to show what it was.

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
  v_answer_status text;
  v_submission record;
  v_before record;
  v_total numeric;
  v_graded int;
  v_needed int;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to grade';
  end if;

  if p_score is null or p_score < 0 or p_score > 20 then
    raise exception 'Score must be between 0 and 20';
  end if;

  select ta.submission_id, ta.status into v_submission_id, v_answer_status
  from public.theory_answers ta
  where ta.id = p_theory_answer_id;

  if v_submission_id is null then
    raise exception 'Theory answer not found';
  end if;

  -- A question the learner never chose carries no mark, and letting one in would put a
  -- score on a blank space and throw the total out.
  if v_answer_status = 'not_selected' then
    raise exception 'That question was not answered on this paper';
  end if;

  select * into v_submission from public.theory_submissions where id = v_submission_id;

  if v_submission.status = 'draft' then
    raise exception 'This paper has not been submitted yet';
  end if;

  if not public.is_course_staff_for(public.course_of_submission(v_submission_id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to grade this paper';
  end if;

  select g.score, g.feedback
  into v_before
  from public.theory_grades g
  where g.theory_answer_id = p_theory_answer_id;

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

  select
    coalesce(sum(g.score), 0),
    count(*),
    coalesce((select count(*) from public.theory_answers ta2
              where ta2.submission_id = v_submission_id
                and ta2.status <> 'not_selected'), 5)
  into v_total, v_graded, v_needed
  from public.theory_grades g
  join public.theory_answers ta on ta.id = g.theory_answer_id
  where ta.submission_id = v_submission_id;

  -- All five answered questions graded means the paper is finished, not before: a
  -- half-marked paper must not read as a result.
  update public.theory_submissions
  set total_score = v_total,
      graded_at = now(),
      graded_by = coalesce(graded_by, auth.uid()),
      status = case
        when v_submission.status = 'released' then 'released'
        when v_graded >= v_needed then 'graded'
        else 'under_review'
      end,
      updated_at = now()
  where id = v_submission_id;

  perform public.log_audit(
    'theory.answer_graded', 'theory_answers', p_theory_answer_id::text, null,
    jsonb_build_object(
      'submission_id', v_submission_id,
      'score', p_score,
      'rubric_ref', p_rubric_ref,
      'regrade', v_before.score is not null,
      'before', case
        when v_before.score is null then null
        else jsonb_build_object('score', v_before.score, 'feedback', v_before.feedback)
      end,
      'after', jsonb_build_object('score', p_score, 'feedback', p_feedback)
    )
  );
end;
$$;

-- Overall feedback is its own call, so release_theory_grade keeps its one argument and
-- the grading screen can save a comment without touching release.

create or replace function public.set_theory_overall_feedback(
  p_submission_id uuid,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to write feedback';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if not public.is_course_staff_for(public.course_of_submission(s.id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to write feedback on this paper';
  end if;
  if s.status = 'draft' then
    raise exception 'This paper has not been submitted yet';
  end if;

  update public.theory_submissions
  set overall_feedback = nullif(btrim(coalesce(p_feedback, '')), ''), updated_at = now()
  where id = p_submission_id;

  perform public.log_audit(
    'theory.feedback_set', 'theory_submissions', p_submission_id::text, null,
    jsonb_build_object('length', length(coalesce(p_feedback, '')))
  );
end;
$$;

-- ============ Release ============
-- The earlier version released a paper whose status happened to be 'graded' without
-- checking that all five answered questions actually carried a mark, which could
-- release a half-marked paper with a total of 20 out of 100.

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
begin
  if not public.has_permission('assessment.grade') and not public.is_admin() then
    raise exception 'Not authorised to release grades';
  end if;

  select * into s from public.theory_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;

  if not public.is_course_staff_for(public.course_of_submission(s.id), auth.uid())
     and not public.is_admin() then
    raise exception 'Not authorised to release this paper';
  end if;

  if s.status = 'released' then
    return;
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
end;
$$;

-- ============ Grants, and no direct writes ============
grant execute on function public.save_theory_answer(uuid, text) to authenticated;
grant execute on function public.submit_theory_submission(uuid) to authenticated;
grant execute on function public.get_theory_workspace(uuid) to authenticated;
grant execute on function public.get_theory_result(uuid) to authenticated;
grant execute on function public.theory_grading_queue(uuid) to authenticated;
grant execute on function public.get_theory_grading_view(uuid) to authenticated;
grant execute on function public.claim_theory_submission(uuid) to authenticated;
grant execute on function public.grade_theory_answer(uuid, numeric, text, text) to authenticated;
grant execute on function public.set_theory_overall_feedback(uuid, text) to authenticated;
grant execute on function public.release_theory_grade(uuid) to authenticated;

-- Every write to a theory table goes through a security definer function above, which
-- re-checks ownership, the draft state and the clock. The write policies that were here
-- are removed because row-level security cannot narrow *which columns* a policy covers:
-- a learner with an update policy on their own draft could set expires_at to next year
-- and invent their own total_score. With no update policy the statement simply matches
-- zero rows, which is the correct answer for every direct write.
drop policy if exists theory_submissions_write on public.theory_submissions;
drop policy if exists theory_answers_update on public.theory_answers;
