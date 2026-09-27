-- LIS 815 LMS — 0003_rls.sql
-- Row Level Security: students only see their own data and course content they may
-- access; answers, model solutions and grades never reach the client before release.

-- ============ Definer helpers used inside policies (bypass RLS, avoid recursion) ============

create or replace function public.course_of_lesson(p_lesson_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.course_id
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  join public.modules m on m.id = c.module_id
  where l.id = p_lesson_id
$$;

create or replace function public.course_of_chapter(p_chapter_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.course_id
  from public.chapters c
  join public.modules m on m.id = c.module_id
  where c.id = p_chapter_id
$$;

create or replace function public.course_of_assessment(p_assessment_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select course_id from public.assessments where id = p_assessment_id
$$;

create or replace function public.course_of_question(p_question_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select course_id from public.assessments where id = q.assessment_id),
    (select course_id from public.question_banks where id = q.bank_id),
    (select m.course_id from public.modules m where m.id = q.module_id),
    (select m.course_id from public.chapters c join public.modules m on m.id = c.module_id where c.id = q.chapter_id)
  )
  from public.questions q
  where q.id = p_question_id
$$;

create or replace function public.course_of_submission(p_submission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.course_id
  from public.theory_submissions t
  join public.assessments s on s.id = t.assessment_id
  where t.id = p_submission_id
$$;

-- ============ Enable RLS on every public table ============

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end;
$$;

-- ============ Identity ============

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.is_superadmin());

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (true);

drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated
  using (true);

drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists course_staff_select on public.course_staff;
create policy course_staff_select on public.course_staff
  for select to authenticated
  using (public.is_course_staff(course_id));

drop policy if exists course_staff_write on public.course_staff;
create policy course_staff_write on public.course_staff
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============ Course structure ============

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select to authenticated
  using (
    (deleted_at is null and status = 'published')
    or public.is_course_staff(id)
  );

drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules
  for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = modules.course_id
        and c.status = 'published'
        and c.deleted_at is null
    )
    or public.is_course_staff(course_id)
  );

drop policy if exists modules_write on public.modules;
create policy modules_write on public.modules
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists chapters_select on public.chapters;
create policy chapters_select on public.chapters
  for select to authenticated
  using (
    exists (
      select 1 from public.modules m
      join public.courses c on c.id = m.course_id
      where m.id = chapters.module_id
        and c.status = 'published'
        and c.deleted_at is null
    )
    or public.is_course_staff(public.course_of_chapter(chapters.id))
  );

drop policy if exists chapters_write on public.chapters;
create policy chapters_write on public.chapters
  for all to authenticated
  using (public.is_course_staff(public.course_of_chapter(chapters.id)))
  with check (public.is_course_staff(
    (select m.course_id from public.modules m where m.id = chapters.module_id)
  ));

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using (
    (
      status = 'published'
      and public.is_enrolled(public.course_of_lesson(lessons.id))
      and exists (
        select 1 from public.courses c
        where c.id = public.course_of_lesson(lessons.id)
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
    or public.is_course_staff(public.course_of_lesson(lessons.id))
  );

drop policy if exists lessons_write on public.lessons;
create policy lessons_write on public.lessons
  for all to authenticated
  using (public.is_course_staff(public.course_of_lesson(lessons.id)))
  with check (public.is_course_staff(
    (select m.course_id
     from public.chapters c
     join public.modules m on m.id = c.module_id
     where c.id = lessons.chapter_id)
  ));

drop policy if exists lesson_sections_select on public.lesson_sections;
create policy lesson_sections_select on public.lesson_sections
  for select to authenticated
  using (public.can_access_lesson(lesson_sections.lesson_id));

drop policy if exists lesson_sections_write on public.lesson_sections;
create policy lesson_sections_write on public.lesson_sections
  for all to authenticated
  using (public.is_course_staff(public.course_of_lesson(lesson_sections.lesson_id)))
  with check (public.is_course_staff(public.course_of_lesson(lesson_sections.lesson_id)));

drop policy if exists lesson_prerequisites_select on public.lesson_prerequisites;
create policy lesson_prerequisites_select on public.lesson_prerequisites
  for select to authenticated
  using (true);

drop policy if exists lesson_prerequisites_write on public.lesson_prerequisites;
create policy lesson_prerequisites_write on public.lesson_prerequisites
  for all to authenticated
  using (public.is_course_staff(public.course_of_lesson(lesson_prerequisites.lesson_id)))
  with check (
    public.is_course_staff(public.course_of_lesson(lesson_prerequisites.lesson_id))
    and public.is_course_staff(public.course_of_lesson(lesson_prerequisites.prerequisite_lesson_id))
  );

-- ============ Learner state ============

drop policy if exists reading_events_select on public.reading_events;
create policy reading_events_select on public.reading_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_lesson(lesson_id))
  );

drop policy if exists course_enrollments_select on public.course_enrollments;
create policy course_enrollments_select on public.course_enrollments
  for select to authenticated
  using (user_id = auth.uid() or public.is_course_staff(course_id));

drop policy if exists course_enrollments_update on public.course_enrollments;
create policy course_enrollments_update on public.course_enrollments
  for update to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists course_enrollments_delete on public.course_enrollments;
create policy course_enrollments_delete on public.course_enrollments
  for delete to authenticated
  using (public.is_course_staff(course_id));

drop policy if exists lesson_progress_select on public.lesson_progress;
create policy lesson_progress_select on public.lesson_progress
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_lesson(lesson_id))
  );

-- Students hold no insert/update/delete policy on lesson_progress:
-- writes go through mark_lesson_complete() and record_reading_event() only.

-- ============ Assessments ============

drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = assessments.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists assessments_write on public.assessments;
create policy assessments_write on public.assessments
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists question_banks_select on public.question_banks;
create policy question_banks_select on public.question_banks
  for select to authenticated
  using (public.is_course_staff(course_id));

drop policy if exists question_banks_write on public.question_banks;
create policy question_banks_write on public.question_banks
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select to authenticated
  using (public.is_course_staff(public.course_of_question(questions.id)));

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions
  for all to authenticated
  using (public.is_course_staff(public.course_of_question(questions.id)))
  with check (public.is_course_staff(coalesce(
    (select course_id from public.assessments where id = questions.assessment_id),
    (select course_id from public.question_banks where id = questions.bank_id),
    (select m.course_id from public.modules m where m.id = questions.module_id),
    (select m.course_id
     from public.chapters c
     join public.modules m on m.id = c.module_id
     where c.id = questions.chapter_id)
  )));

drop policy if exists question_options_select on public.question_options;
create policy question_options_select on public.question_options
  for select to authenticated
  using (public.is_course_staff(public.course_of_question(question_options.question_id)));

drop policy if exists question_options_write on public.question_options;
create policy question_options_write on public.question_options
  for all to authenticated
  using (public.is_course_staff(public.course_of_question(question_options.question_id)))
  with check (public.is_course_staff(public.course_of_question(question_options.question_id)));

drop policy if exists assessment_attempts_select on public.assessment_attempts;
create policy assessment_attempts_select on public.assessment_attempts
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_assessment(assessment_id))
  );

drop policy if exists attempt_answers_select on public.attempt_answers;
create policy attempt_answers_select on public.attempt_answers
  for select to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_answers.attempt_id
      and a.user_id = auth.uid()
  ));

drop policy if exists attempt_answers_insert on public.attempt_answers;
create policy attempt_answers_insert on public.attempt_answers
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_answers.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'in_progress'
    )
    and public.question_in_attempt(attempt_answers.attempt_id, attempt_answers.question_id)
    and (
      attempt_answers.selected_option_id is null
      or public.option_belongs_to_question(
           attempt_answers.selected_option_id,
           attempt_answers.question_id
         )
    )
  );

drop policy if exists attempt_answers_update on public.attempt_answers;
create policy attempt_answers_update on public.attempt_answers
  for update to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_answers.attempt_id
      and a.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.assessment_attempts a
      where a.id = attempt_answers.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'in_progress'
    )
    and public.question_in_attempt(attempt_answers.attempt_id, attempt_answers.question_id)
    and (
      attempt_answers.selected_option_id is null
      or public.option_belongs_to_question(
           attempt_answers.selected_option_id,
           attempt_answers.question_id
         )
    )
  );

drop policy if exists attempt_answers_delete on public.attempt_answers;
create policy attempt_answers_delete on public.attempt_answers
  for delete to authenticated
  using (exists (
    select 1 from public.assessment_attempts a
    where a.id = attempt_answers.attempt_id
      and a.user_id = auth.uid()
      and a.status = 'in_progress'
  ));

-- ============ Theory examination ============

drop policy if exists theory_submissions_select on public.theory_submissions;
create policy theory_submissions_select on public.theory_submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff(public.course_of_submission(theory_submissions.id))
  );

drop policy if exists theory_answers_select on public.theory_answers;
create policy theory_answers_select on public.theory_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.theory_submissions s
      where s.id = theory_answers.submission_id
        and s.user_id = auth.uid()
    )
    or public.is_course_staff(public.course_of_submission(theory_answers.submission_id))
  );

drop policy if exists theory_answers_update on public.theory_answers;
create policy theory_answers_update on public.theory_answers
  for update to authenticated
  using (exists (
    select 1 from public.theory_submissions s
    where s.id = theory_answers.submission_id
      and s.user_id = auth.uid()
      and s.status = 'draft'
  ))
  with check (exists (
    select 1 from public.theory_submissions s
    where s.id = theory_answers.submission_id
      and s.user_id = auth.uid()
      and s.status = 'draft'
  ));

drop policy if exists theory_grades_select on public.theory_grades;
create policy theory_grades_select on public.theory_grades
  for select to authenticated
  using (
    public.is_course_staff(public.course_of_submission(
      (select submission_id from public.theory_answers where id = theory_grades.theory_answer_id)
    ))
    or exists (
      select 1
      from public.theory_answers ta
      join public.theory_submissions s on s.id = ta.submission_id
      where ta.id = theory_grades.theory_answer_id
        and s.user_id = auth.uid()
        and s.status = 'released'
    )
  );

drop policy if exists theory_grades_write on public.theory_grades;
create policy theory_grades_write on public.theory_grades
  for all to authenticated
  using (public.has_permission('assessment.grade') or public.is_admin())
  with check (public.has_permission('assessment.grade') or public.is_admin());

-- ============ Content support ============

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and visibility = 'students'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = resources.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists resources_write on public.resources;
create policy resources_write on public.resources
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists glossary_terms_select on public.glossary_terms;
create policy glossary_terms_select on public.glossary_terms
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = glossary_terms.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists glossary_terms_write on public.glossary_terms;
create policy glossary_terms_write on public.glossary_terms
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists bookmarks_select on public.bookmarks;
create policy bookmarks_select on public.bookmarks
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists bookmarks_insert on public.bookmarks;
create policy bookmarks_insert on public.bookmarks
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists bookmarks_delete on public.bookmarks;
create policy bookmarks_delete on public.bookmarks
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and publish_at <= now()
      and (audience = 'all' or public.is_enrolled(course_id))
      and exists (
        select 1 from public.courses c
        where c.id = announcements.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ============ Practical activities ============

drop policy if exists practical_activities_select on public.practical_activities;
create policy practical_activities_select on public.practical_activities
  for select to authenticated
  using (
    public.is_course_staff(course_id)
    or (
      status = 'published'
      and public.is_enrolled(course_id)
      and exists (
        select 1 from public.courses c
        where c.id = practical_activities.course_id
          and c.status = 'published'
          and c.deleted_at is null
      )
    )
  );

drop policy if exists practical_activities_write on public.practical_activities;
create policy practical_activities_write on public.practical_activities
  for all to authenticated
  using (public.is_course_staff(course_id))
  with check (public.is_course_staff(course_id));

drop policy if exists practical_submissions_select on public.practical_submissions;
create policy practical_submissions_select on public.practical_submissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff((select course_id from public.practical_activities where id = practical_submissions.activity_id))
  );

drop policy if exists practical_submissions_insert on public.practical_submissions;
create policy practical_submissions_insert on public.practical_submissions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.practical_activities pa
      where pa.id = activity_id
        and pa.status = 'published'
        and public.is_enrolled(pa.course_id)
    )
  );

drop policy if exists practical_submissions_update on public.practical_submissions;
create policy practical_submissions_update on public.practical_submissions
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_course_staff((select course_id from public.practical_activities where id = practical_submissions.activity_id))
  )
  with check (
    user_id = auth.uid()
    or public.is_course_staff((select course_id from public.practical_activities where id = practical_submissions.activity_id))
  );

-- ============ Outcomes and platform ============

drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates
  for select to authenticated
  using (user_id = auth.uid() or public.is_course_staff(course_id));

drop policy if exists certificates_update on public.certificates;
create policy certificates_update on public.certificates
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (not is_secret or public.is_admin());

drop policy if exists system_settings_write on public.system_settings;
create policy system_settings_write on public.system_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists search_index_select on public.search_index;
create policy search_index_select on public.search_index
  for select to authenticated
  using (public.is_admin());

-- rate_limits: no policies; service role only (BYPASSRLS).

-- ============ Column guards for tables students may write ============

create or replace function public.protect_attempt_answers()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.is_correct is not null then
    raise exception 'is_correct is calculated by the server';
  end if;
  if tg_op = 'UPDATE' and new.is_correct is distinct from old.is_correct then
    raise exception 'is_correct is calculated by the server';
  end if;
  if tg_op = 'UPDATE' and new.attempt_id is distinct from old.attempt_id then
    raise exception 'attempt_id cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_attempt_answers on public.attempt_answers;
create trigger protect_attempt_answers
  before insert or update on public.attempt_answers
  for each row execute function public.protect_attempt_answers();

create or replace function public.protect_theory_answers()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and (
    new.submission_id is distinct from old.submission_id
    or new.question_id is distinct from old.question_id
    or new.status is distinct from old.status
  ) then
    raise exception 'This field is managed by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_theory_answers on public.theory_answers;
create trigger protect_theory_answers
  before insert or update on public.theory_answers
  for each row execute function public.protect_theory_answers();

create or replace function public.protect_practical_grading()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' and (
    new.score is not null
    or new.feedback is not null
    or new.graded_by is not null
    or new.graded_at is not null
  ) then
    raise exception 'Grading fields are managed by the server';
  end if;
  if tg_op = 'UPDATE' and (
    new.score is distinct from old.score
    or new.feedback is distinct from old.feedback
    or new.graded_by is distinct from old.graded_by
    or new.graded_at is distinct from old.graded_at
    or (new.status = 'graded' and old.status <> 'graded')
    or new.activity_id is distinct from old.activity_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'Grading fields are managed by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_practical_grading on public.practical_submissions;
create trigger protect_practical_grading
  before insert or update on public.practical_submissions
  for each row execute function public.protect_practical_grading();
