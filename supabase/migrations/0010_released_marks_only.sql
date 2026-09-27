-- 0010 — the mark stays off the learner's row until release.
--
-- A learner may read their own theory_submissions row (that is how the "where is my
-- paper" list is built), so anything written there is readable by them. grade_theory_answer()
-- used to publish a running total after the first answer was marked, which handed a
-- half-marked paper's score to the learner days before the marker released it. Two changes
-- follow from that: the total is only written once every answer carries a mark, and a row
-- that holds a mark the learner has not been given yet cannot be selected by them at all.

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

  -- A released paper is the mark the learner has already been given. Changing it behind
  -- their back would make the result they can read differ from the result on record, so
  -- the answer is no: corrections have to be asked for, not slipped in.
  if v_submission.status = 'released' then
    raise exception 'This paper has been released and can no longer be marked';
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
  -- half-marked paper must not read as a result, and until then total_score stays null
  -- so the row never carries a mark the learner is not meant to have.
  update public.theory_submissions
  set total_score = case when v_graded >= v_needed then v_total else total_score end,
      graded_at = case when v_graded >= v_needed then now() else graded_at end,
      graded_by = case when v_graded >= v_needed then coalesce(graded_by, auth.uid()) else graded_by end,
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

-- Releasing twice used to return quietly, which tells the marker nothing: they cannot
-- tell an already-released paper from one the button failed on. The second release says
-- what happened instead. (The other half of this rule — no re-marking after release —
-- lives in grade_theory_answer above.)

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
end;
$$;

-- The learner keeps their own paper while it is being written, submitted and marked up,
-- and sees it again the moment it is released. What they never get is a row carrying a
-- total_score they have not been given: released_at is what turns that column on for them.
drop policy if exists theory_submissions_select on public.theory_submissions;
create policy theory_submissions_select on public.theory_submissions
  for select to authenticated
  using (
    (
      user_id = auth.uid()
      and (total_score is null or released_at is not null)
    )
    or public.is_course_staff(public.course_of_submission(theory_submissions.id))
  );
