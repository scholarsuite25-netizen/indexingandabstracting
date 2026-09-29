create or replace function public.admin_dashboard_stats(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_staff boolean;
  v_pass_mark int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  v_staff := public.is_course_staff_for(p_course_id, v_user_id);
  if not v_staff then
    raise exception 'Not authorised to view dashboard stats';
  end if;

  v_pass_mark := coalesce(public.get_setting_int('objective_pass_mark', 50), 50);

  return jsonb_build_object(
    'learners', (
      select count(*)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id
        and ce.status in ('active', 'completed')
    ),
    'active_learners', (
      select count(distinct ce.user_id)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id
        and ce.status in ('active', 'completed')
        and exists (
          select 1 from public.reading_events re
          where re.user_id = ce.user_id and re.created_at >= now() - interval '14 days'
          union
          select 1 from public.lesson_progress lp
          where lp.user_id = ce.user_id and lp.completed_at >= now() - interval '14 days'
        )
    ),
    'completion_rate', coalesce((
      select round(avg(ce.progress_pct), 2)
      from public.course_enrollments ce
      where ce.course_id = p_course_id and ce.status = 'active'
    ), 0),
    'attempts', (
      select count(*)::int
      from public.assessment_attempts aa
      join public.assessments a on a.id = aa.assessment_id
      where a.course_id = p_course_id
        and aa.status in ('submitted', 'marked')
    ),
    'avg_score', coalesce((
      select round(avg(aa.percentage), 2)
      from public.assessment_attempts aa
      join public.assessments a on a.id = aa.assessment_id
      where a.course_id = p_course_id
        and aa.status in ('submitted', 'marked')
    ), 0),
    'theory_eligible', (
      select count(*)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id and ce.status = 'active'
        and coalesce(public.best_objective_percentage(p_course_id, ce.user_id), 0) >= v_pass_mark
    ),
    'grading_queue', (
      select count(*)::int
      from public.theory_submissions ts
      where public.course_of_submission(ts.id) = p_course_id
        and ts.status in ('submitted', 'under_review')
    ),
    'completions', (
      select count(*)::int
      from public.course_enrollments ce
      where ce.course_id = p_course_id and ce.status = 'completed'
    ),
    'certificates', (
      select count(*)::int
      from public.certificates c
      where c.course_id = p_course_id and c.status = 'issued'
    ),
    'recent_registrations', (
      select count(*)::int
      from public.profiles p
      where p.created_at >= now() - interval '30 days'
    ),
    'engagement', (
      select coalesce(jsonb_agg(row_to_json(e) order by e.completed desc), '[]'::jsonb)
      from (
        select m.id, m.title, count(*)::int as completed
        from public.lesson_progress lp
        join public.lessons l on l.id = lp.lesson_id
        join public.chapters c on c.id = l.chapter_id
        join public.modules m on m.id = c.module_id
        where m.course_id = p_course_id and lp.status = 'completed'
        group by m.id, m.title
        order by completed desc
        limit 6
      ) e
    )
  );
end;
$$;

create or replace function public.question_analytics(p_assessment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_course uuid;
  v_staff boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  select a.course_id into v_course from public.assessments a where a.id = p_assessment_id;
  if v_course is null then
    raise exception 'Assessment not found';
  end if;
  v_staff := public.is_course_staff_for(v_course, v_user_id);
  if not v_staff then
    raise exception 'Not authorised to view question analytics';
  end if;

  return jsonb_build_object(
    'assessment_id', p_assessment_id,
    'questions', (
      select coalesce(jsonb_agg(q_json order by q_json.position), '[]'::jsonb)
      from (
        select
          q.id, q.position, q.stem_md, q.type, q.points,
          (
            select count(*)::int
            from public.attempt_answers aa
            where aa.question_id = q.id
          ) as n_attempts,
          (
            select count(*)::int
            from public.attempt_answers aa
            where aa.question_id = q.id and aa.is_correct = true
          ) as correct_count,
          case
            when (select count(*)::int from public.attempt_answers aa where aa.question_id = q.id) > 0
            then round(
              (select count(*)::numeric
               from public.attempt_answers aa
               where aa.question_id = q.id and aa.is_correct = true)
              / (select count(*)::numeric
                 from public.attempt_answers aa
                 where aa.question_id = q.id), 2)
            else null
          end as difficulty_index,
          (
            select coalesce(jsonb_agg(o_json order by o_json.label), '[]'::jsonb)
            from (
              select
                o.label, o.text, o.is_correct,
                (select count(*)::int from public.attempt_answers aa where aa.selected_option_id = o.id) as times_chosen
              from public.question_options o
              where o.question_id = q.id
              order by o.position
            ) o_json
          ) as options
        from public.questions q
        where q.assessment_id = p_assessment_id
          and q.status = 'published'
          and q.type = 'mcq'
      ) q_json
    )
  );
end;
$$;

create or replace function public.admin_report(p_course_id uuid, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_course_staff_for(p_course_id, v_user_id) then
    raise exception 'Not authorised';
  end if;

  if p_kind = 'learners' then
    return (
      select jsonb_build_object('rows', coalesce(jsonb_agg(r order by r.full_name, r.email), '[]'::jsonb))
      from (
        select
          p.id as user_id, p.full_name, p.email,
          ce.enrolled_at, ce.progress_pct, ce.required_lessons_done,
          coalesce(public.best_objective_percentage(p_course_id, p.id), 0) as best_objective,
          ts.status as theory_status, ts.total_score as theory_score, ts.released_at,
          ce.status, ce.completed_at,
          greatest(coalesce(re.last_active, lp.last_active, ce.enrolled_at)) as last_active
        from public.profiles p
        join public.course_enrollments ce on ce.user_id = p.id and ce.course_id = p_course_id
        left join (
          select user_id, max(created_at) as last_active
          from public.reading_events group by user_id
        ) re on re.user_id = p.id
        left join (
          select user_id, max(completed_at) as last_active
          from public.lesson_progress where status = 'completed' group by user_id
        ) lp on lp.user_id = p.id
        left join lateral (
          select ts2.status, ts2.total_score, ts2.released_at
          from public.theory_submissions ts2
          where ts2.user_id = p.id
            and ts2.assessment_id in (select id from public.assessments where course_id = p_course_id and type = 'theory')
          order by ts2.submitted_at desc
          limit 1
        ) ts on true
      ) r
    );
  elsif p_kind = 'attempts' then
    return (
      select jsonb_build_object('rows', coalesce(jsonb_agg(r order by r.submitted_at desc nulls last), '[]'::jsonb))
      from (
        select
          p.email, a.type as assessment_type, a.title, aa.attempt_no,
          aa.status, aa.percentage, aa.started_at, aa.submitted_at, aa.marked_at
        from public.assessment_attempts aa
        join public.assessments a on a.id = aa.assessment_id
        join public.profiles p on p.id = aa.user_id
        where a.course_id = p_course_id
      ) r
    );
  elsif p_kind = 'grades' then
    return (
      select jsonb_build_object('rows', coalesce(jsonb_agg(r order by r.released_at desc nulls last), '[]'::jsonb))
      from (
        select
          p.email, a.title, a.type,
          ts.total_score, ts.graded_at, ts.released_at, ts.status
        from public.theory_submissions ts
        join public.profiles p on p.id = ts.user_id
        join public.assessments a on a.id = ts.assessment_id
        where a.course_id = p_course_id and ts.status in ('graded', 'released')
        union all
        select
          p.email, a.title, 'objective',
          aa.percentage, aa.marked_at, null, aa.status
        from public.assessment_attempts aa
        join public.assessments a on a.id = aa.assessment_id
        join public.profiles p on p.id = aa.user_id
        where a.course_id = p_course_id and a.type = 'objective' and aa.status = 'marked'
      ) r
    );
  end if;

  return jsonb_build_object('rows', '[]'::jsonb);
end;
$$;

create or replace function public.move_content_row(p_kind text, p_id uuid, p_delta int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_course uuid;
  v_other uuid;
  v_pos int;
  v_tmp int := -2147483648;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  if p_kind = 'module' then
    select course_id into v_course from public.modules where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.modules where id = p_id;
    select id into v_other from public.modules
      where course_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.modules set position = v_tmp where id = p_id;
    update public.modules set position = v_pos where id = v_other;
    update public.modules set position = v_pos + p_delta where id = p_id;
  elsif p_kind = 'chapter' then
    select module_id into v_course from public.chapters where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.chapters where id = p_id;
    select id into v_other from public.chapters
      where module_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.chapters set position = v_tmp where id = p_id;
    update public.chapters set position = v_pos where id = v_other;
    update public.chapters set position = v_pos + p_delta where id = p_id;
  elsif p_kind = 'lesson' then
    select chapter_id into v_course from public.lessons where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.lessons where id = p_id;
    select id into v_other from public.lessons
      where chapter_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.lessons set position = v_tmp where id = p_id;
    update public.lessons set position = v_pos where id = v_other;
    update public.lessons set position = v_pos + p_delta where id = p_id;
  elsif p_kind = 'section' then
    select lesson_id into v_course from public.lesson_sections where id = p_id;
    if v_course is null then raise exception 'Not found'; end if;
    if not public.is_course_staff_for(v_course, v_user_id) then raise exception 'Not authorised'; end if;
    if p_delta not in (-1, 1) then raise exception 'Use delta -1 or 1'; end if;
    select position into v_pos from public.lesson_sections where id = p_id;
    select id into v_other from public.lesson_sections
      where lesson_id = v_course and position = v_pos + p_delta limit 1;
    if v_other is null then raise exception 'Nothing to swap'; end if;
    update public.lesson_sections set position = v_tmp where id = p_id;
    update public.lesson_sections set position = v_pos where id = v_other;
    update public.lesson_sections set position = v_pos + p_delta where id = p_id;
  else
    raise exception 'Unknown kind: use module, chapter, lesson, section';
  end if;

  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id);
end;
$$;
