-- LIS 815 LMS — 0005_search.sql
-- Full-text search over lessons, glossary, resources and announcements.
-- Students only ever receive rows they could open anyway (access checks run server-side).

create or replace function public.index_lesson(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lesson record;
  v_body text;
begin
  select
    l.id,
    l.title,
    m.course_id,
    (l.status = 'published'
     and c.status = 'published'
     and co.status = 'published'
     and co.deleted_at is null) as visible
  into v_lesson
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  join public.modules m on m.id = c.module_id
  join public.courses co on co.id = m.course_id
  where l.id = p_lesson_id;

  if not found then
    delete from public.search_index where entity_type = 'lesson' and entity_id = p_lesson_id;
    return;
  end if;

  if not v_lesson.visible then
    delete from public.search_index where entity_type = 'lesson' and entity_id = p_lesson_id;
    return;
  end if;

  select coalesce(string_agg(
    coalesce(s.title, '') || E'\n' || s.content_md, E'\n' order by s.position
  ), '')
  into v_body
  from public.lesson_sections s
  where s.lesson_id = p_lesson_id;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'lesson', p_lesson_id, v_lesson.course_id, v_lesson.title, v_body,
    to_tsvector('english', v_lesson.title),
    to_tsvector('english', v_body)
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.index_glossary(p_term_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select g.id, g.term, g.definition, g.course_id, g.module_id, co.status as course_status
  into v
  from public.glossary_terms g
  join public.courses co on co.id = g.course_id
  where g.id = p_term_id;

  if not found or v.course_status <> 'published' then
    delete from public.search_index where entity_type = 'glossary' and entity_id = p_term_id;
    return;
  end if;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'glossary', p_term_id, v.course_id, v.term, v.definition,
    to_tsvector('english', v.term),
    to_tsvector('english', v.definition)
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.index_resource(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select r.id, r.title, r.description, r.course_id, r.status, r.visibility, co.status as course_status
  into v
  from public.resources r
  join public.courses co on co.id = r.course_id
  where r.id = p_resource_id;

  if not found or v.status <> 'published' or v.visibility <> 'students' or v.course_status <> 'published' then
    delete from public.search_index where entity_type = 'resource' and entity_id = p_resource_id;
    return;
  end if;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'resource', p_resource_id, v.course_id, v.title, coalesce(v.description, ''),
    to_tsvector('english', v.title),
    to_tsvector('english', coalesce(v.description, ''))
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.index_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select a.id, a.title, a.body_md, a.course_id, a.status, a.publish_at, co.status as course_status
  into v
  from public.announcements a
  join public.courses co on co.id = a.course_id
  where a.id = p_announcement_id;

  if not found or v.status <> 'published' or v.publish_at > now() or v.course_status <> 'published' then
    delete from public.search_index where entity_type = 'announcement' and entity_id = p_announcement_id;
    return;
  end if;

  insert into public.search_index (entity_type, entity_id, course_id, title, body, title_tsv, body_tsv)
  values (
    'announcement', p_announcement_id, v.course_id, v.title, v.body_md,
    to_tsvector('english', v.title),
    to_tsvector('english', v.body_md)
  )
  on conflict (entity_type, entity_id) do update
    set course_id = excluded.course_id,
        title = excluded.title,
        body = excluded.body,
        title_tsv = excluded.title_tsv,
        body_tsv = excluded.body_tsv,
        updated_at = now();
end;
$$;

create or replace function public.rebuild_search_index()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  for r in select id from public.lessons loop
    perform public.index_lesson(r.id);
  end loop;
  for r in select id from public.glossary_terms loop
    perform public.index_glossary(r.id);
  end loop;
  for r in select id from public.resources loop
    perform public.index_resource(r.id);
  end loop;
  for r in select id from public.announcements loop
    perform public.index_announcement(r.id);
  end loop;
end;
$$;

create or replace function public.search_content(p_query text, p_limit int default 20)
returns table (
  entity_type text,
  entity_id uuid,
  course_id uuid,
  title text,
  snippet text,
  rank real
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ts tsquery;
begin
  if p_query is null or btrim(p_query) = '' then
    return;
  end if;

  v_ts := plainto_tsquery('english', p_query);
  if v_ts is null then
    return;
  end if;

  return query
  select
    s.entity_type,
    s.entity_id,
    s.course_id,
    s.title,
    left(s.body, 240) as snippet,
    ts_rank(setweight(s.title_tsv, 'A') || setweight(s.body_tsv, 'B'), v_ts) as rank
  from public.search_index s
  where (s.title_tsv @@ v_ts or s.body_tsv @@ v_ts)
    and (
      public.is_admin()
      or public.is_course_staff(s.course_id)
      or (
        s.course_id in (
          select ce.course_id from public.course_enrollments ce
          where ce.user_id = auth.uid() and ce.status in ('active', 'completed')
        )
        and (
          (s.entity_type = 'lesson' and public.can_access_lesson(s.entity_id))
          or s.entity_type in ('glossary', 'resource', 'announcement')
        )
      )
    )
  order by rank desc, s.title
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- ============ Keep the index in sync ============

create or replace function public.trg_lesson_lesson_sections_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.index_lesson(coalesce(new.lesson_id, old.lesson_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists lesson_sections_reindex on public.lesson_sections;
create trigger lesson_sections_reindex
  after insert or update or delete on public.lesson_sections
  for each row execute function public.trg_lesson_lesson_sections_touch();

create or replace function public.trg_lesson_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.index_lesson(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists lessons_reindex on public.lessons;
create trigger lessons_reindex
  after insert or update or delete on public.lessons
  for each row execute function public.trg_lesson_touch();

create or replace function public.trg_glossary_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'glossary' and entity_id = old.id;
    return old;
  end if;
  perform public.index_glossary(new.id);
  return new;
end;
$$;

drop trigger if exists glossary_terms_reindex on public.glossary_terms;
create trigger glossary_terms_reindex
  after insert or update or delete on public.glossary_terms
  for each row execute function public.trg_glossary_touch();

create or replace function public.trg_resource_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'resource' and entity_id = old.id;
    return old;
  end if;
  perform public.index_resource(new.id);
  return new;
end;
$$;

drop trigger if exists resources_reindex on public.resources;
create trigger resources_reindex
  after insert or update or delete on public.resources
  for each row execute function public.trg_resource_touch();

create or replace function public.trg_announcement_touch()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.search_index where entity_type = 'announcement' and entity_id = old.id;
    return old;
  end if;
  perform public.index_announcement(new.id);
  return new;
end;
$$;

drop trigger if exists announcements_reindex on public.announcements;
create trigger announcements_reindex
  after insert or update or delete on public.announcements
  for each row execute function public.trg_announcement_touch();

-- Initial build (safe on an empty database).
select public.rebuild_search_index();
