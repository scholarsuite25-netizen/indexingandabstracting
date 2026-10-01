// LIS 815 LMS — migration validator (no Docker, no Supabase account needed).
// Runs migrations 0001-0005 against a throwaway Postgres-in-WASM (PGlite),
// emulating the Supabase auth schema and API roles.
//
//   npm run check:sql

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const SMOKE_USER = '00000000-0000-0000-0000-0000000000aa';
const SMOKE_STUDENT = '00000000-0000-0000-0000-0000000000bb';
const SMOKE_OUTSIDER = '00000000-0000-0000-0000-0000000000cc';

// Supabase grants these to the API roles, and it does so with *default privileges*:
// anything a migration creates afterwards is born granted, so a migration that takes a
// grant away (0014_verify_requires_login.sql) actually keeps it taken away. PGlite runs
// everything as the table owner, which bypasses RLS, so without the grants the "as a
// student" tests prove nothing.
const DEFAULT_PRIVILEGES = `
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

// Applied after the migrations, and deliberately without functions: re-granting
// `execute on all functions` here would silently undo a revoke written by a migration.
const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
`;

const PRELUDE = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.sub', true), '')::uuid
$$;

create schema if not exists storage;

create table if not exists storage.buckets (
  id             text primary key,
  name           text not null,
  public         boolean default false,
  file_size_limit bigint,
  created_at     timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;
`;

function fail(msg) {
  console.error('');
  console.error(`FAILED: ${msg}`);
  process.exit(1);
}

// Reusable by scripts/seed.mjs (--pglite mode): fresh DB + prelude + all migrations.
export async function createMigratedDb() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const db = await PGlite.create();
  await db.exec(PRELUDE);
  await db.exec(DEFAULT_PRIVILEGES);
  for (const f of files) {
    await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  }
  await db.exec(GRANTS);
  return db;
}

async function expectError(db, label, sql, pattern) {
  try {
    await db.exec(sql);
    fail(`${label} — expected an error, but the statement succeeded`);
  } catch (e) {
    if (pattern && !pattern.test(e.message)) {
      fail(`${label} — wrong error message: ${e.message}`);
    }
    console.log(`  PASS  ${label}`);
  }
}

async function main() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) fail('no migration files found');

  console.log('LIS 815 LMS — migration validator (PGlite)');
  console.log(`Migrations: ${files.length} files`);

  const db = await PGlite.create();

  try {
    await db.exec(PRELUDE);
    await db.exec(DEFAULT_PRIVILEGES);
  } catch (e) {
    fail(`Supabase emulation prelude: ${e.message}`);
  }
  console.log('  PASS  Supabase emulation prelude (auth schema + API roles)');
  console.log('');

  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    try {
      await db.exec(sql);
      console.log(`  PASS  ${f}`);
    } catch (e) {
      console.log(`  FAIL  ${f}`);
      console.log('');
      console.error(e.message);
      process.exit(1);
    }
  }

  console.log('');
  console.log('Idempotency check (running every migration a second time)');

  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    try {
      await db.exec(sql);
      console.log(`  PASS  ${f} (second run)`);
    } catch (e) {
      console.log(`  FAIL  ${f} (second run)`);
      console.log('');
      console.error(e.message);
      process.exit(1);
    }
  }

  console.log('');
  console.log('Smoke tests');

  await db.exec(GRANTS);

  const tables = await db.query(
    `select count(*)::int as n from pg_tables where schemaname = 'public'`
  );
  if (tables.rows[0].n < 30) fail(`expected >= 30 tables, found ${tables.rows[0].n}`);
  console.log(`  PASS  tables created (${tables.rows[0].n})`);

  const policies = await db.query(
    `select count(*)::int as n from pg_policies where schemaname = 'public'`
  );
  if (policies.rows[0].n < 40) fail(`expected >= 40 policies, found ${policies.rows[0].n}`);
  console.log(`  PASS  row level security policies created (${policies.rows[0].n})`);

  const rls = await db.query(
    `select count(*)::int as n from pg_class c
     join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`
  );
  const total = await db.query(
    `select count(*)::int as n from pg_class c
     join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r'`
  );
  if (rls.rows[0].n !== total.rows[0].n) {
    fail(`RLS not enabled on ${total.rows[0].n - rls.rows[0].n} table(s)`);
  }
  console.log(`  PASS  RLS enabled on every table (${total.rows[0].n})`);

  const settings = await db.query(`select public.get_setting('theory_pass_mark') as v`);
  if (String(settings.rows[0].v) !== '50') fail(`theory_pass_mark seed wrong: ${settings.rows[0].v}`);
  console.log('  PASS  settings seeded (theory_pass_mark = 50)');

  const rpcs = await db.query(`
    select count(*)::int as n from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_dashboard_stats','question_analytics','admin_report','move_content_row')
  `);
  if (rpcs.rows[0].n !== 4) fail(`expected 4 new reporting functions, found ${rpcs.rows[0].n}`);
  console.log('  PASS  reporting RPCs installed (admin_dashboard_stats, question_analytics, admin_report, move_content_row)');

  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data)
    values ('${SMOKE_USER}', 'smoke@example.com', '{"full_name":"Smoke Test"}');
  `);
  const prof = await db.query(`select full_name from public.profiles where email = 'smoke@example.com'`);
  if (prof.rows.length !== 1 || prof.rows[0].full_name !== 'Smoke Test') fail('profile trigger did not fire');
  const role = await db.query(`
    select r.code from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where p.email = 'smoke@example.com'
  `);
  if (role.rows.length !== 1 || role.rows[0].code !== 'student') fail('default student role not assigned');
  console.log('  PASS  signup trigger creates profile + student role');

  const trig = await db.query(
    `select count(*)::int as n from pg_trigger
     where tgname = 'set_updated_at' and not tgisinternal`
  );
  if (trig.rows[0].n < 20) fail(`expected >= 20 updated_at triggers, found ${trig.rows[0].n}`);
  console.log(`  PASS  updated_at triggers installed (${trig.rows[0].n})`);

  await db.exec(`insert into public.courses (code, title, status) values ('SMOKE', 'Smoke Course', 'published');`);

  await expectError(
    db,
    'two correct options per question are rejected',
    `
    insert into public.question_banks (course_id, name)
      values ((select id from public.courses where code = 'SMOKE'), 'Bank 1');
    insert into public.questions (bank_id, stem_md, type)
      values ((select id from public.question_banks where name = 'Bank 1'), 'smoke-q1', 'mcq');
    insert into public.question_options (question_id, label, text, is_correct)
      values ((select id from public.questions where stem_md = 'smoke-q1'), 'A', 'first', true);
    insert into public.question_options (question_id, label, text, is_correct)
      values ((select id from public.questions where stem_md = 'smoke-q1'), 'B', 'second', true);
    `,
    /only one correct option/i
  );

  await expectError(
    db,
    'theory selection must be exactly 5 questions',
    `
    select set_config('request.jwt.sub', '${SMOKE_USER}', false);
    insert into public.assessments (course_id, type, title, status)
      values ((select id from public.courses where code = 'SMOKE'), 'theory', 'Smoke Theory', 'published');
    insert into public.questions (assessment_id, stem_md, type, position, status)
      select (select id from public.assessments where title = 'Smoke Theory'),
             'tq' || g, 'essay', g, 'published'
      from generate_series(1, 7) g;
    insert into public.theory_submissions (assessment_id, user_id, status)
      select a.id, p.id, 'draft'
      from public.assessments a
      join public.profiles p on p.email = 'smoke@example.com'
      where a.title = 'Smoke Theory';
    select public.select_theory_questions(
      (select id from public.theory_submissions where status = 'draft' limit 1),
      (
        select array_agg(s.id)
        from (
          select q.id
          from public.questions q
          join public.assessments a on a.id = q.assessment_id
          where a.title = 'Smoke Theory'
          order by q.position
          limit 4
        ) s
      )
    );
    `,
    /exactly 5/
  );

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_USER}', false);`);
  const claim1 = await db.query(`select public.claim_first_superadmin() as r`);
  if (!claim1.rows[0].r.claimed) fail(`first claim failed: ${JSON.stringify(claim1.rows[0].r)}`);
  const exists1 = await db.query(`select public.superadmin_exists() as e`);
  if (!exists1.rows[0].e) fail('superadmin_exists() false after claim');
  const claim2 = await db.query(`select public.claim_first_superadmin() as r`);
  if (claim2.rows[0].r.claimed) fail('second claim should be rejected');
  const smRoles = await db.query(`
    select r.code from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = '${SMOKE_USER}'
    order by r.code
  `);
  const codes = smRoles.rows.map((row) => row.code);
  if (!codes.includes('superadmin') || !codes.includes('student')) {
    fail(`smoke user roles wrong: ${codes.join(',')}`);
  }
  const audits = await db.query(
    `select count(*)::int as n from public.audit_logs where action = 'role.superadmin_claimed'`
  );
  if (audits.rows[0].n < 1) fail('superadmin claim was not audited');
  console.log('  PASS  superadmin claim is one-time, grants role, writes audit log');

  console.log('');
  console.log('Student writes under RLS (running as the authenticated role)');

  // A second account that stays an ordinary student, so nothing bypasses RLS below.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data)
    values ('${SMOKE_STUDENT}', 'rls@example.com', '{"full_name":"RLS Student"}');
    insert into auth.users (id, email, raw_user_meta_data)
    values ('${SMOKE_OUTSIDER}', 'outsider@example.com', '{"full_name":"No Enrolment"}');

    insert into public.modules (course_id, position, title, status)
      select id, 1, 'Smoke Module', 'published' from public.courses where code = 'SMOKE';
    insert into public.chapters (module_id, position, title, slug, status)
      select id, 1, 'Smoke Chapter', 'smoke-chapter', 'published'
      from public.modules where title = 'Smoke Module';
    insert into public.lessons (chapter_id, position, title, kind, is_required, status)
      select id, 1, 'Smoke Lesson', 'reading', false, 'published'
      from public.chapters where slug = 'smoke-chapter';
    insert into public.lesson_sections (lesson_id, position, kind, title, content_md)
      select id, 1, 'prose', 'Why smoke testing matters',
             'Smoke testing catches broken migrations before a learner finds them.'
      from public.lessons where title = 'Smoke Lesson';
    select public.index_lesson(id) from public.lessons where title = 'Smoke Lesson';

    insert into public.assessments (course_id, type, title, status, pass_mark)
      select id, 'objective', 'Smoke Objective', 'published', 50
      from public.courses where code = 'SMOKE';
    insert into public.questions (assessment_id, stem_md, type, position, status)
      select id, 'smoke-obj-q1', 'mcq', 1, 'published'
      from public.assessments where title = 'Smoke Objective';
    insert into public.question_options (question_id, label, text, position, is_correct)
      select q.id, 'A', 'first smoke option', 1, true
      from public.questions q where q.stem_md = 'smoke-obj-q1';
    insert into public.question_options (question_id, label, text, position, is_correct)
      select q.id, 'B', 'second smoke option', 2, false
      from public.questions q where q.stem_md = 'smoke-obj-q1';
    insert into public.questions (assessment_id, stem_md, type, position, status)
      select id, 'smoke-obj-q2', 'mcq', 2, 'published'
      from public.assessments where title = 'Smoke Objective';
    insert into public.question_options (question_id, label, text, position, is_correct)
      select q.id, 'A', 'other question option', 1, true
      from public.questions q where q.stem_md = 'smoke-obj-q2';
  `);

  // Ids are read here, while still the table owner: a student cannot select from
  // question_options at all, so a subquery would silently resolve to null below.
  // Question 2 also gets an option of its own, so the refusal below proves the
  // policy checks ownership rather than merely "is this option id null?".
  const ids = await db.query(`
    select
      (select id from public.questions where stem_md = 'smoke-obj-q1') as q1,
      (select id from public.questions where stem_md = 'smoke-obj-q2') as q2,
      (select qo.id from public.question_options qo
        join public.questions q on q.id = qo.question_id
        where q.stem_md = 'smoke-obj-q1' and qo.label = 'A') as q1_opt_a
  `);
  const { q1, q2, q1_opt_a: q1OptA } = ids.rows[0];

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  let attemptId;

  try {
    const enrolled = await db.query(
      `select public.enroll_self(
         (select id from public.courses where code = 'SMOKE')
       ) as id`
    );
    if (!enrolled.rows[0].id) fail('enroll_self returned nothing for a student');
    console.log('  PASS  a student can enrol themselves through the RPC');

    // search_content used to fail at call time with "operator does not exist:
    // tsvector + tsvector" — plpgsql bodies are not checked until they run.
    const hits = await db.query(`select * from public.search_content('smoke testing')`);
    if (hits.rows.length < 1) fail('search_content returned no rows for a seeded lesson');
    console.log(`  PASS  search_content runs and finds the lesson (${hits.rows.length} hit)`);

    const attempt = await db.query(
      `select public.start_objective_attempt(
         (select id from public.assessments where title = 'Smoke Objective')
       ) as id`
    );
    attemptId = attempt.rows[0].id;
    if (!attemptId) fail('start_objective_attempt returned nothing for a student');

    // The option must belong to the question being answered, and a student may not
    // read question_options, so the policy has to ask through a SECURITY DEFINER
    // helper. A plain subquery silently fails for every student.
    await db.exec(`
      insert into public.attempt_answers (attempt_id, question_id, selected_option_id)
      values ('${attemptId}'::uuid, '${q1}'::uuid, '${q1OptA}'::uuid);
    `);
    console.log('  PASS  a student can record an answer to their own open attempt');

    await expectError(
      db,
      'an answer cannot point at an option from another question',
      `
      insert into public.attempt_answers (attempt_id, question_id, selected_option_id)
      values ('${attemptId}'::uuid, '${q2}'::uuid, '${q1OptA}'::uuid);
      `,
      /row-level security/i
    );

    await expectError(
      db,
      'a student cannot set is_correct themselves',
      `
      update public.attempt_answers set is_correct = true
      where attempt_id = '${attemptId}'::uuid;
      `,
      /calculated by the server/i
    );

    const graded = await db.query(
      `select public.submit_objective_attempt('${attemptId}'::uuid) as r`
    );
    const pct = Number(graded.rows[0].r.percentage);
    if (pct !== 50) fail(`expected 50% after one correct answer of two, got ${pct}`);
    console.log('  PASS  the server marks the attempt (50% from the saved answer)');

    const again = await db.query(
      `select public.submit_objective_attempt('${attemptId}'::uuid) as r`
    );
    if (Number(again.rows[0].r.percentage) !== 50) fail('a second submit changed the score');
    if (again.rows[0].r.already_submitted !== true) fail('a second submit was not reported as such');
    console.log('  PASS  submitting twice keeps one score and says so');

    await expectError(
      db,
      'a closed attempt refuses further answers',
      `select public.save_answer('${attemptId}'::uuid, '${q2}'::uuid, '${q1OptA}'::uuid)`,
      /closed/i
    );

    const res = await db.query(`select public.get_attempt_results('${attemptId}'::uuid) as r`);
    if (res.rows[0].r.show_correct_answers !== true) fail('results hid the correct answer');
    if (res.rows[0].r.questions.length !== 2) fail('results did not list both questions');
    const leaked = JSON.stringify(res.rows[0].r.questions.filter((q) => q.is_correct === true));
    if (!leaked.includes('true')) fail('is_correct was not reported after marking');
    console.log('  PASS  results reveal the correct option only after marking');

    // ---- the gate, seen by the student ----
    const selfGate = await db.query(`select public.theory_eligibility(
      (select id from public.courses where code = 'SMOKE')
    ) as r`);
    if (selfGate.rows[0].r.state !== 'below_threshold') {
      fail(`expected below_threshold at 50 percent, got ${selfGate.rows[0].r.state}`);
    }
    if (selfGate.rows[0].r.threshold !== 70) fail(`gate threshold is ${selfGate.rows[0].r.threshold}`);
    console.log('  PASS  a student can ask the gate where they stand (50% of 70)');

    const centre = await db.query(`select public.assessment_centre(
      (select id from public.courses where code = 'SMOKE')
    ) as r`);
    const objective = centre.rows[0].r.assessments.find((a) => a.type === 'objective');
    if (!objective) fail('assessment_centre did not return the objective paper');
    if (objective.question_count !== 2) fail(`question_count wrong: ${objective.question_count}`);
    if (objective.attempts.length !== 1) fail('attempt history missing from the centre');
    console.log('  PASS  assessment_centre returns question count and attempt history');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- the gate, at every boundary ----
  // Run as the table owner: a learner cannot edit a closed attempt's score, which is
  // the point of the policy above. Each row is the best percentage the server accepts.
  const gateState = async (pct) => {
    await db.exec(`
      update public.assessment_attempts
      set score = ${pct}, total = 100, percentage = ${pct}, passed = ${pct >= 70}
      where id = '${attemptId}'::uuid;
    `);
    const el = await db.query(`select public.theory_eligibility(
      (select id from public.courses where code = 'SMOKE'), '${SMOKE_STUDENT}'
    ) as r`);
    return el.rows[0].r;
  };

  for (const [pct, want] of [[0, 'below_threshold'], [69, 'below_threshold'], [70, 'eligible'], [100, 'eligible']]) {
    const got = await gateState(pct);
    if (got.state !== want) fail(`${pct} percent gave ${got.state}, expected ${want}`);
  }
  const at70 = await gateState(70);
  if (!/70 percent/.test(at70.reason)) fail(`eligible reason is unclear: ${at70.reason}`);
  const at69 = await gateState(69);
  if (!/best score is 69 percent/.test(at69.reason)) fail(`locked reason is unclear: ${at69.reason}`);
  console.log('  PASS  the 70% gate: 0 and 69 stay locked, 70 and 100 unlock');

  const outsider = await db.query(`select public.theory_eligibility(
    (select id from public.courses where code = 'SMOKE'), '${SMOKE_OUTSIDER}'
  ) as r`);
  if (outsider.rows[0].r.state !== 'not_enrolled') {
    fail(`expected not_enrolled, got ${outsider.rows[0].r.state}`);
  }
  await db.exec(`
    insert into public.course_enrollments (course_id, user_id, status)
      select id, '${SMOKE_OUTSIDER}', 'active' from public.courses where code = 'SMOKE'
    on conflict (course_id, user_id) do nothing;
  `);
  const fresh = await db.query(`select public.theory_eligibility(
    (select id from public.courses where code = 'SMOKE'), '${SMOKE_OUTSIDER}'
  ) as r`);
  if (fresh.rows[0].r.state !== 'not_attempted') {
    fail(`expected not_attempted, got ${fresh.rows[0].r.state}`);
  }
  console.log('  PASS  the gate says not_enrolled and not_attempted before blaming a score');

  // ---- expiry: a timed-out attempt still scores what was saved ----
  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    const timed = await db.query(`
      select public.start_objective_attempt(
        (select id from public.assessments where title = 'Smoke Objective')
      ) as id
    `);
    const timedId = timed.rows[0].id;
    await db.exec(`
      update public.assessments set duration_minutes = 1
      where title = 'Smoke Objective';
    `);
    // Backdate the attempt instead of waiting a minute.
    await db.exec(`
      update public.assessment_attempts
      set expires_at = now() - interval '1 minute'
      where id = '${timedId}'::uuid;
    `);

    // The runner must be told the attempt is over, not shown an error: raising here
    // would roll back the marking that has to survive.
    const late = await db.query(
      `select public.save_answer('${timedId}'::uuid, '${q1}'::uuid, '${q1OptA}'::uuid) as r`
    );
    if (late.rows[0].r.expired !== true) fail('an expired attempt did not report the expiry');
    if (late.rows[0].r.saved !== false) fail('an answer was saved after the clock ran out');
    if (late.rows[0].r.status !== 'expired') fail(`expected status expired, got ${late.rows[0].r.status}`);

    const expired = await db.query(`select * from public.assessment_attempts where id = '${timedId}'::uuid`);
    if (expired.rows[0].status !== 'expired') fail(`the row was not marked expired: ${expired.rows[0].status}`);
    if (expired.rows[0].percentage === null) fail('the expired attempt was left unscored');

    const scored = await db.query(`select public.get_attempt_results('${timedId}'::uuid) as r`);
    if (scored.rows[0].r.expired !== true) fail('results do not report the expiry');
    if (scored.rows[0].r.percentage === null) fail('an expired attempt returned no score');
    console.log('  PASS  a timed-out attempt is marked from its saved answers and says so');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- Phase 7: the 5-of-7 theory examination ----
  console.log('');
  console.log('Theory examination (5 of 7)');

  // Fixtures, one statement at a time: a single failed statement would take the rest of
  // the batch down with it, and these rows are what the rest of the block reads.
  await db.exec(`
    insert into public.assessments (course_id, type, title, status, duration_minutes)
      select id, 'theory', 'Smoke Theory', 'published', null
      from public.courses where code = 'SMOKE'
    on conflict do nothing;
  `);
  await db.exec(`
    insert into public.questions (assessment_id, stem_md, type, position, points, status, model_answer_md)
    select (select id from public.assessments where title = 'Smoke Theory'),
           'theory question ' || g, 'essay', g, 20, 'published', 'model answer ' || g
    from generate_series(1, 7) g
    where not exists (
      select 1 from public.questions q
      join public.assessments a on a.id = q.assessment_id
      where a.title = 'Smoke Theory'
    );
  `);
  await db.exec(`
    insert into public.theory_submissions (assessment_id, user_id, status)
    select (select id from public.assessments where title = 'Smoke Theory'),
           id, 'draft'
    from public.profiles where id = '${SMOKE_USER}'
    and not exists (
      select 1 from public.theory_submissions
      where user_id = '${SMOKE_USER}' and status = 'draft'
    );
  `);
  // create_theory_submission() would do this, but it sits behind the objective gate, so
  // the fixture lays down the answer rows itself.
  await db.exec(`
    insert into public.theory_answers (submission_id, question_id, status)
    select ts.id, q.id, 'not_selected'
    from public.theory_submissions ts
    join public.questions q
      on q.assessment_id = ts.assessment_id and q.status = 'published'
    where ts.assessment_id = (select id from public.assessments where title = 'Smoke Theory')
      and not exists (
        select 1 from public.theory_answers ta where ta.submission_id = ts.id
      )
    on conflict do nothing;
  `);

  const theory = await db.query(`
    select
      (select id from public.theory_submissions where status = 'draft' limit 1) as submission,
      (select array_agg(q.id order by q.position)
       from public.questions q
       join public.assessments a on a.id = q.assessment_id
       where a.title = 'Smoke Theory') as all_questions
  `);
  if (!theory.rows[0]?.submission) fail('the theory fixture did not create a draft submission');
  const submissionId = theory.rows[0].submission;
  const qIds = theory.rows[0].all_questions;
  if (qIds.length !== 7) fail(`the theory fixture made ${qIds.length} questions, expected 7`);
  const qA = (n) => `'${qIds[n]}'::uuid`;
  const answerOf = (n) => `
    (select id from public.theory_answers
     where submission_id = '${submissionId}'::uuid and question_id = ${qA(n)})`;

  // As the table owner, so RLS is out of the way and the trigger is what is under test.
  //
  // The certificate rules need a marked objective attempt, and the theory fixture
  // does not create one - so without this the release below could never issue a
  // certificate and the auto-issue path would go untested.
  await db.exec(`
    insert into public.assessment_attempts
      (assessment_id, user_id, attempt_no, status, score, total, percentage, passed)
    select obj.id, ts.user_id, 1, 'marked', 85, 100, 85, true
    from public.theory_submissions ts
    join public.assessments th on th.id = ts.assessment_id
    join public.assessments obj on obj.course_id = th.course_id and obj.type = 'objective'
    where ts.id = '${submissionId}'::uuid
    on conflict (user_id, assessment_id, attempt_no) do update
      set status = 'marked', score = 85, total = 100, percentage = 85, passed = true
  `);

  // ...and one required lesson, already read, because the certificate rules also
  // need every required lesson of the course to be completed.
  await db.exec(`
    with paper as (
      select th.course_id, ts.user_id
      from public.theory_submissions ts
      join public.assessments th on th.id = ts.assessment_id
      where ts.id = '${submissionId}'::uuid
    ), mod as (
      insert into public.modules (id, course_id, position, title)
        select '00000000-0000-0000-0000-00000000c001', course_id, 99, 'SMOKE certificate module'
        from paper
      returning id
    ), chap as (
      insert into public.chapters (id, module_id, position, title, slug)
        select '00000000-0000-0000-0000-00000000c002', mod.id, 1,
               'SMOKE certificate chapter', 'smoke-certificate-chapter'
        from mod
      returning id
    ), les as (
      insert into public.lessons (id, chapter_id, position, title)
        select '00000000-0000-0000-0000-00000000c003', chap.id, 1, 'SMOKE certificate lesson'
        from chap
      returning id
    )
    insert into public.lesson_progress (user_id, lesson_id, status, reading_pct, completed_at)
    select paper.user_id, les.id, 'completed', 100, now()
    from paper, les
    on conflict (user_id, lesson_id) do update
      set status = 'completed', reading_pct = 100, completed_at = now()
  `);

  await expectError(
    db,
    'the trigger refuses a submitted paper with no answers',
    `update public.theory_submissions set status = 'submitted'
     where id = '${submissionId}'::uuid`,
    /exactly 5 questions/i
  );

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    // RLS filters rows out of an UPDATE rather than raising, so this is checked by
    // counting: another learner's draft is not the reader's to touch.
    const reach = await db.query(`
      with touched as (
        update public.theory_submissions set total_words = 9999
        where id = '${submissionId}'::uuid
        returning 1
      ) select count(*)::int as n from touched
    `);
    if (reach.rows[0].n !== 0) fail('a learner reached another learner’s draft paper');
    // Nor can they read it back afterwards: the select policy is scoped the same way.
    const readBack = await db.query(
      `select total_words from public.theory_submissions where id = '${submissionId}'::uuid`
    );
    if (readBack.rows.length !== 0) fail('a learner can read another learner’s paper');
    console.log('  PASS  a draft paper is the owner’s alone, to read or to edit');
  } finally {
    await db.exec(`reset role`);
  }

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_USER}', false)`);
  await db.exec(`set role authenticated`);
  try {
    await expectError(
      db,
      'an unselected question cannot be written to',
      `select public.save_theory_answer(${answerOf(6)}, 'too early')`,
      /select this question/i
    );

    await db.query(`
      select public.select_theory_questions('${submissionId}'::uuid,
        array[${qA(0)}, ${qA(1)}, ${qA(2)}, ${qA(3)}, ${qA(4)}])
    `);

    const saved = await db.query(`
      select public.save_theory_answer(${answerOf(0)},
        'Indexing is the process of building an index to speed retrieval.') as r
    `);
    if (saved.rows[0].r.word_count !== 11) {
      fail(`word count is ${saved.rows[0].r.word_count}, expected 11`);
    }
    if (saved.rows[0].r.saved !== true) fail('a first autosave was not reported as saved');
    console.log('  PASS  an answer autosaves with a word count');

    const perAnswer = 11;
    for (const n of [1, 2, 3]) {
      const filled = await db.query(`
        select public.save_theory_answer(${answerOf(n)},
          'A considered answer with supporting detail drawn from the course material.') as r
      `);
      if (filled.rows[0].r.saved !== true) fail(`answer ${n + 1} did not save`);
      if (filled.rows[0].r.word_count !== perAnswer) {
        fail(`answer ${n + 1} counted ${filled.rows[0].r.word_count} words, expected ${perAnswer}`);
      }
    }

    await expectError(
      db,
      'submitting with an empty answer is refused',
      `select public.submit_theory_submission('${submissionId}'::uuid)`,
      /needs an answer/i
    );

    const fifth = await db.query(`
      select public.save_theory_answer(${answerOf(4)},
        'A considered answer with supporting detail drawn from the course material.') as r
    `);
    if (fifth.rows[0].r.word_count !== perAnswer) {
      fail(`answer 5 counted ${fifth.rows[0].r.word_count} words, expected ${perAnswer}`);
    }

    await db.query(`select public.submit_theory_submission('${submissionId}'::uuid)`);
    const closed = await db.query(`
      select status, total_words, submitted_at,
             (select count(*) from unnest(selected_question_ids)) as picked
      from public.theory_submissions where id = '${submissionId}'::uuid
    `);
    if (closed.rows[0].status !== 'submitted') fail(`the paper did not submit: ${closed.rows[0].status}`);
    if (Number(closed.rows[0].picked) !== 5) fail(`${closed.rows[0].picked} questions were recorded, expected 5`);
    if (Number(closed.rows[0].total_words) !== perAnswer * 5) {
      fail(`the paper counts ${closed.rows[0].total_words} words, expected ${perAnswer * 5}`);
    }
    console.log('  PASS  five written answers submit; the trigger guards a direct write too');

    await expectError(
      db,
      'a submitted paper can no longer be edited',
      `select public.save_theory_answer(${answerOf(0)}, 'a late correction')`,
      /locked/i
    );

    await db.query(`select public.submit_theory_submission('${submissionId}'::uuid)`);
    const still = await db.query(`
      select submitted_at from public.theory_submissions where id = '${submissionId}'::uuid
    `);
    if (String(still.rows[0].submitted_at) !== String(closed.rows[0].submitted_at)) {
      fail('a second submit moved the submission time');
    }
    console.log('  PASS  a submitted paper is locked and submitting twice changes nothing');

    const workspace = await db.query(
      `select public.get_theory_workspace('${submissionId}'::uuid) as r`
    );
    if (workspace.rows[0].r.questions.length !== 7) fail('the workspace is not showing 7 questions');
    if (JSON.stringify(workspace.rows[0].r).includes('model_answer')) {
      fail('the learner workspace leaked the model answers');
    }
    console.log('  PASS  the learner workspace shows 7 questions and no model answers');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- grading, as staff ----
  await db.query(`select set_config('request.jwt.sub', '${SMOKE_USER}', false)`);
  await db.exec(`set role authenticated`);
  try {
    const queue = await db.query(
      `select public.theory_grading_queue((select id from public.courses where code = 'SMOKE')) as r`
    );
    const inQueue = queue.rows[0].r.submissions;
    if (inQueue.length !== 1) fail(`the queue holds ${inQueue.length} papers, expected 1`);
    if (inQueue[0].id !== submissionId) fail('the queue is showing the wrong paper');
    if (inQueue[0].status !== 'submitted') fail(`the queue shows a ${inQueue[0].status} paper`);
    if (inQueue[0].graded_count !== 0) fail('an ungraded paper reports graded answers');
    if (inQueue[0].answer_count !== 5) fail(`the queue counts ${inQueue[0].answer_count} answers, expected 5`);
    console.log('  PASS  the queue shows the submitted paper and not the closed draft');

    await expectError(
      db,
      'a question the learner never chose cannot be marked',
      `select public.grade_theory_answer(${answerOf(6)}, 10)`,
      /not answered on this paper/i
    );

    const view = await db.query(
      `select public.get_theory_grading_view('${submissionId}'::uuid) as r`
    );
    if (view.rows[0].r.answers.length !== 5) fail('the grading view is not showing 5 answers');
    if (!view.rows[0].r.answers[0].model_answer_md) {
      fail('the staff grading view has no model answer to mark against');
    }
    if (!/indicative and not exhaustive/i.test(view.rows[0].r.model_answer_caveat)) {
      fail('the model-answer caveat is missing from the grading view');
    }

    const scores = [18, 17, 20, 19, 20];
    for (const [index, score] of scores.entries()) {
      await db.query(`
        select public.grade_theory_answer(${answerOf(index)}, ${score},
          'Well argued and referenced.', 'Q7 p.42')
      `);
      const midway = await db.query(`
        select status, total_score from public.theory_submissions
        where id = '${submissionId}'::uuid
      `);
      const isLast = index === scores.length - 1;
      if (isLast && midway.rows[0].status !== 'graded') {
        fail(`the paper is ${midway.rows[0].status} after all five answers are marked`);
      }
      if (!isLast && midway.rows[0].status !== 'under_review') {
        fail(`a half-marked paper read as ${midway.rows[0].status} after ${index + 1} answers`);
      }
      // The learner can read their own submission row, so total_score may only land there
      // once every answer carries a mark: a running total would publish a half-marked paper.
      const wantTotal = isLast ? scores.reduce((a, b) => a + b, 0) : null;
      const gotTotal = midway.rows[0].total_score == null ? null : Number(midway.rows[0].total_score);
      if (gotTotal !== wantTotal) {
        fail(`the total is ${midway.rows[0].total_score} after ${index + 1} answers, expected ${wantTotal}`);
      }
    }
    console.log('  PASS  18+17+20+19+20 totals 94, and the paper only reads as graded at the end');

    await db.query(`
      select public.grade_theory_answer(${answerOf(0)}, 15,
        'Reconsidered: the citation is missing.', 'Q7 p.42')
    `);
    const after = await db.query(`
      select status, total_score from public.theory_submissions where id = '${submissionId}'::uuid
    `);
    if (Number(after.rows[0].total_score) !== 91) {
      fail(`after a re-grade the total is ${after.rows[0].total_score}, expected 91`);
    }
    const audited = await db.query(`
      select after as detail from public.audit_logs
      where action = 'theory.answer_graded' and (after->>'regrade')::boolean
      order by created_at desc limit 1
    `);
    if (Number(audited.rows[0]?.detail?.before?.score) !== 18) {
      fail(`the audit entry does not record the previous score: ${JSON.stringify(audited.rows[0]?.detail)}`);
    }
    if (Number(audited.rows[0]?.detail?.after?.score) !== 15) {
      fail('the audit entry does not record the new score');
    }
    console.log('  PASS  a re-grade keeps the total right and audits before and after');

    await expectError(
      db,
      'the result cannot be read before release',
      `select public.get_theory_result('${submissionId}'::uuid)`,
      /not been released/i
    );

    await db.query(`select public.release_theory_grade('${submissionId}'::uuid)`);
    const released = await db.query(`
      select status, released_at from public.theory_submissions where id = '${submissionId}'::uuid
    `);
    if (released.rows[0].status !== 'released') fail(`the paper is ${released.rows[0].status}`);
    console.log('  PASS  a fully marked paper releases');

    await db.query(
      `select public.set_theory_overall_feedback('${submissionId}'::uuid, 'A strong paper overall.')`
    );
    const result = await db.query(`select public.get_theory_result('${submissionId}'::uuid) as r`);
    if (Number(result.rows[0].r.total_score) !== 91) fail('the result total is wrong');
    if (result.rows[0].r.answers.length !== 5) fail('the result is not showing 5 answers');
    if (JSON.stringify(result.rows[0].r).includes('model_answer')) {
      fail('the released result leaked the model answers');
    }
    if (result.rows[0].r.overall_feedback !== 'A strong paper overall.') {
      fail('the overall feedback did not reach the learner');
    }
    if (result.rows[0].r.passed !== true) fail('a total of 91 did not read as a pass');
    if (Number(result.rows[0].r.max_score) !== 100) fail('the result reports the wrong maximum');
    console.log('  PASS  the released result shows marks and feedback, never a model answer');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- a second learner's own draft, for the ownership and expiry checks ----
  await db.exec(`
    insert into public.theory_submissions (assessment_id, user_id, status)
      select (select id from public.assessments where title = 'Smoke Theory'),
             '${SMOKE_STUDENT}'::uuid, 'draft'
    on conflict do nothing;
  `);
  await db.exec(`
    insert into public.theory_answers (submission_id, question_id, status)
    select ts.id, q.id, 'not_selected'
    from public.theory_submissions ts
    join public.questions q
      on q.assessment_id = ts.assessment_id and q.status = 'published'
    where ts.user_id = '${SMOKE_STUDENT}' and ts.status = 'draft'
      and not exists (
        select 1 from public.theory_answers ta where ta.submission_id = ts.id
      )
    on conflict do nothing;
  `);

  // ---- a student may not grade, queue, or write grades ----
  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    // The learner picks their five, so the paper and its answer rows really are theirs.
    await db.query(`
      select public.select_theory_questions(
        (select id from public.theory_submissions
         where user_id = '${SMOKE_STUDENT}' and status = 'draft' limit 1),
        array[${qA(0)}, ${qA(1)}, ${qA(2)}, ${qA(3)}, ${qA(4)}])
    `);

    await expectError(
      db,
      'a student cannot open the grading queue',
      `select public.theory_grading_queue((select id from public.courses where code = 'SMOKE'))`,
      /not authorised/i
    );
    await expectError(
      db,
      'a student cannot open the grading view',
      `select public.get_theory_grading_view('${submissionId}'::uuid)`,
      /not authorised/i
    );
    await expectError(
      db,
      'a student cannot grade an answer',
      `select public.grade_theory_answer(${answerOf(0)}, 20)`,
      /not authorised/i
    );
    await expectError(
      db,
      'a student cannot release a paper',
      `select public.release_theory_grade('${submissionId}'::uuid)`,
      /not authorised/i
    );
    await expectError(
      db,
      'a student cannot insert a grade row directly',
      `
      insert into public.theory_grades (theory_answer_id, score, feedback, graded_by)
      select id, 20, 'full marks', '${SMOKE_STUDENT}'
      from public.theory_answers
      where submission_id = (select id from public.theory_submissions
                             where user_id = '${SMOKE_STUDENT}' and status = 'draft')
      limit 1
      `,
      /row-level security/i
    );
    console.log('  PASS  a student reaches neither the queue, the grading view, nor the grades table');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- a draft is not work, and it cannot be marked ----
  await db.query(`select set_config('request.jwt.sub', '${SMOKE_USER}', false)`);
  await db.exec(`set role authenticated`);
  try {
    const after = await db.query(
      `select public.theory_grading_queue((select id from public.courses where code = 'SMOKE')) as r`
    );
    if (after.rows[0].r.submissions.length !== 1) {
      fail(`a new draft appeared in the queue: ${after.rows[0].r.submissions.length} papers`);
    }
    console.log('  PASS  a fresh draft stays out of the grading queue');

    const draft = await db.query(`
      select ts.id,
             (select ta.id from public.theory_answers ta
              where ta.submission_id = ts.id and ta.status = 'draft' limit 1) as answer
      from public.theory_submissions ts
      where ts.user_id = '${SMOKE_STUDENT}' and ts.status = 'draft' limit 1
    `);
    const draftId = draft.rows[0].id;
    const draftAnswer = draft.rows[0].answer;
    if (!draftAnswer) fail('the student draft has no selected answer to try to mark');

    await expectError(
      db,
      'a paper still in draft cannot be graded',
      `select public.grade_theory_answer('${draftAnswer}'::uuid, 20)`,
      /not been submitted/i
    );
    await expectError(
      db,
      'overall feedback cannot be written to a draft',
      `select public.set_theory_overall_feedback('${draftId}'::uuid, 'too early')`,
      /not been submitted/i
    );
    console.log('  PASS  staff cannot mark or comment on a paper nobody has handed in');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- a learner cannot write their own paper directly ----
  // This is the hole a row-level policy cannot close on its own: policies are per row,
  // not per column, so allowing a learner to update their own draft would also allow
  // them to move their own deadline and invent their own total. Every write must go
  // through a security definer function, so the table simply has no update policy.
  const draftRow = await db.query(`
    select id from public.theory_submissions
    where user_id = '${SMOKE_STUDENT}' and status = 'draft'
    order by started_at asc limit 1
  `);
  const tamperedId = draftRow.rows[0].id;
  const beforeTamper = await db.query(`
    select expires_at, total_score from public.theory_submissions where id = '${tamperedId}'::uuid
  `);

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    // No error is expected: an inaccessible UPDATE matches zero rows and says nothing,
    // which is exactly why this hole is so easy to miss.
    const extend = await db.query(`
      update public.theory_submissions
      set expires_at = now() + interval '10 years', total_score = 100
      where id = '${tamperedId}'::uuid
    `);
    if (extend.rows.length !== 0) {
      fail('a learner was able to update their own theory submission row directly');
    }

    const selfMark = await db.query(`
      update public.theory_answers
      set status = 'graded'
      where submission_id = '${tamperedId}'::uuid
    `);
    if (selfMark.rows.length !== 0) {
      fail('a learner was able to update their own theory answer rows directly');
    }

    await expectError(
      db,
      'a learner inserting their own theory grade',
      `
        insert into public.theory_grades (theory_answer_id, score, graded_by, feedback)
        select id, 20, '${SMOKE_STUDENT}', 'full marks, obviously'
        from public.theory_answers
        where submission_id = '${tamperedId}'::uuid limit 1;
      `,
    );
  } finally {
    await db.exec(`reset role`);
  }

  const afterTamper = await db.query(`
    select expires_at, total_score from public.theory_submissions where id = '${tamperedId}'::uuid
  `);
  if (String(afterTamper.rows[0].expires_at) !== String(beforeTamper.rows[0].expires_at)) {
    fail('the learner moved their own exam deadline');
  }
  if (Number(afterTamper.rows[0].total_score) !== Number(beforeTamper.rows[0].total_score)) {
    fail('the learner changed their own total score');
  }
  console.log('  PASS  a learner cannot touch expires_at, total_score or their own grade rows');

  // ---- out of time: the paper closes with whatever was written ----
  // The clock is moved as the table owner. A learner cannot do this, which is the point.
  const draft = await db.query(`
    select id from public.theory_submissions
    where user_id = '${SMOKE_STUDENT}' and status = 'draft'
    order by started_at asc limit 1
  `);
  const draftId = draft.rows[0].id;
  await db.exec(`
    update public.theory_submissions set expires_at = now() - interval '1 minute'
    where id = '${draftId}'::uuid;
  `);

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    const beat = await db.query(`
      select public.save_theory_answer(
        (select id from public.theory_answers
         where submission_id = '${draftId}'::uuid and status = 'draft'
         order by question_id limit 1),
        'Whatever I had managed to write before the clock ran out.'
      ) as r
    `);
    if (beat.rows[0].r.expired !== true) fail('a timed-out paper did not report the expiry');
    if (beat.rows[0].r.saved !== false) fail('an answer was saved after the clock ran out');
    const beatRow = await db.query(`
      select status, total_words from public.theory_submissions where id = '${draftId}'::uuid
    `);
    if (beatRow.rows[0].status !== 'submitted') {
      fail(`the timed-out paper was left as ${beatRow.rows[0].status} instead of being closed`);
    }
    if (Number(beatRow.rows[0].total_words) !== 0) {
      fail(`the timed-out paper counted ${beatRow.rows[0].total_words} words, expected 0`);
    }
    console.log('  PASS  a timed-out paper is closed with what was written, not left as a draft');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- Phase 8: study tooling ----

  await db.exec(`
    insert into public.resources (course_id, title, description, kind, visibility, status, url)
    values
      ((select id from public.courses where code = 'SMOKE'), 'SMOKE exam paper',
       'staff reference', 'exam_paper', 'students', 'published', '/papers/objective'),
      ((select id from public.courses where code = 'SMOKE'), 'SMOKE study link',
       'for learners', 'link', 'students', 'published', '/help');
    insert into public.notifications (user_id, type, title, body, link)
    values ('${SMOKE_STUDENT}', 'system', 'Result released', 'Your theory paper has been marked.', '/dashboard');
  `);

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    const seen = await db.query(`select title from public.resources`);
    const titles = seen.rows.map((r) => r.title);
    if (titles.includes('SMOKE exam paper')) {
      fail('a student can read an examination paper resource');
    }
    if (!titles.includes('SMOKE study link')) {
      fail('a student cannot read a published student resource');
    }
    console.log('  PASS  examination papers are never a student resource');

    await db.exec(`
      update public.notifications set read_at = now()
      where user_id = '${SMOKE_STUDENT}' and title = 'Result released';
    `);
    await expectError(
      db,
      'a learner cannot rewrite their own notification',
      `
      update public.notifications set title = 'System: you have passed the course'
      where user_id = '${SMOKE_STUDENT}';
      `,
      /marked read/i,
    );
    console.log('  PASS  a notification can only be marked read, never rewritten');
  } finally {
    await db.exec(`reset role`);
  }

  const staffView = await db.query(`select count(*)::int as n from public.resources`);
  if (staffView.rows[0].n !== 2) {
    fail(`expected both resource rows to exist, found ${staffView.rows[0].n}`);
  }
  console.log('  PASS  both resource rows exist (staff and system views are complete)');

  // ---- Phase 10: verification (signed-in) and revocation ----
  //
  // The certificates table has no `to anon` policy: a stranger who could query it
  // directly could also page through every certificate the course has issued. So
  // /verify/[number] goes through the SECURITY DEFINER function — reached only from
  // behind a sign-in (proxy.ts) — and since migration 0014 the function is granted to
  // `authenticated` alone. These checks run it as a signed-in user; a further check
  // proves the anon role is refused outright.

  const certNumber = 'LIS815-2026-CERT000001';
  await db.exec(`
    insert into public.certificates (user_id, course_id, certificate_number, status)
    values ('${SMOKE_STUDENT}',
            (select id from public.courses where code = 'SMOKE'),
            '${certNumber}', 'issued')
    on conflict (certificate_number) do nothing;
  `);

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.query(
    `select set_config('request.headers', '{"x-forwarded-for":"203.0.113.10"}', false)`
  );
  await db.exec(`set role authenticated`);
  try {
    const lookup = await db.query(
      `select public.get_public_certificate('${certNumber}') as r`
    );
    const payload = lookup.rows[0].r;
    if (payload.found !== true) {
      fail('a signed-in visitor cannot look up a real certificate number');
    }
    if (payload.number !== certNumber) {
      fail('public verification returned the wrong certificate number');
    }
    if (!payload.student_name) {
      fail('public verification did not return the learner name');
    }
    if (payload.status !== 'issued') {
      fail(`public verification reported status ${payload.status}, expected issued`);
    }
    const leaked = ['user_id', 'email', 'id', 'course_id', 'issued_by', 'eligibility_snapshot']
      .filter((k) => Object.prototype.hasOwnProperty.call(payload, k));
    if (leaked.length) fail(`public verification leaked ${leaked.join(', ')}`);
    console.log('  PASS  a signed-in visitor verifies a certificate and sees only public fields');

    const missing = await db.query(
      `select public.get_public_certificate('LIS815-2026-NOPE000000') as r`
    );
    if (missing.rows[0].r.found !== false) {
      fail('a made-up certificate number came back as found');
    }
    console.log('  PASS  a made-up certificate number is not found');

    // 30 lookups a minute per caller address; the 31st is refused.
    await db.query(
      `select set_config('request.headers', '{"x-forwarded-for":"203.0.113.11"}', false)`
    );
    let limitedAt = null;
    for (let i = 1; i <= 31; i++) {
      const r = await db.query(`select public.get_public_certificate('${certNumber}') as r`);
      const hit = r.rows[0].r;
      if (hit.rate_limited) {
        limitedAt = i;
        break;
      }
      if (hit.found !== true) fail(`public lookup ${i} failed before the limit was reached`);
    }
    if (limitedAt !== 31) {
      fail(`the rate limit kicked in at call ${limitedAt ?? 'never'}, expected call 31`);
    }
    console.log('  PASS  public verification stops after 30 lookups a minute per caller');
  } finally {
    await db.exec(`reset role`);
  }

  // Migration 0014 took the anon (and PUBLIC) grant away, so the database itself refuses
  // a caller with no session — the page gate and the grant agree.
  await db.query(`select set_config('request.jwt.sub', '', false)`);
  await db.exec(`set role anon`);
  try {
    await expectError(
      db,
      'a signed-out caller is refused by the database (grant is authenticated-only)',
      `select public.get_public_certificate('${certNumber}');`,
      /permission denied/i,
    );
  } finally {
    await db.exec(`reset role`);
  }

  // Only an administrator can revoke, a reason is required, and revocation is audited.
  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.exec(`set role authenticated`);
  try {
    await expectError(
      db,
      'a learner cannot revoke a certificate',
      `select public.revoke_certificate(
         (select id from public.certificates where certificate_number = '${certNumber}'),
         'I changed my mind'
       );`,
      /only administrators/i,
    );
  } finally {
    await db.exec(`reset role`);
  }

  await db.exec(`insert into public.user_roles (user_id, role_id)
    select '${SMOKE_USER}', id from public.roles where code = 'admin'`);

  await db.query(`select set_config('request.jwt.sub', '${SMOKE_USER}', false)`);
  await db.exec(`set role authenticated`);
  try {
    await expectError(
      db,
      'a revocation with no reason is refused',
      `select public.revoke_certificate(
         (select id from public.certificates where certificate_number = '${certNumber}'),
         ' '
       );`,
      /reason/i,
    );

    await db.query(`
      select public.revoke_certificate(
        (select id from public.certificates where certificate_number = '${certNumber}'),
        'Issued to the wrong learner'
      )
    `);
  } finally {
    await db.exec(`reset role`);
  }

  const revokedAudit = await db.query(`
    select count(*)::int as n from public.audit_logs where action = 'certificate.revoked'
  `);
  if (revokedAudit.rows[0].n !== 1) {
    fail(`revocation wrote ${revokedAudit.rows[0].n} audit rows, expected 1`);
  }
  console.log('  PASS  only an administrator can revoke, with a reason, and it is audited');

  // A fresh caller address: the previous one has just spent its thirty lookups.
  await db.query(`select set_config('request.jwt.sub', '${SMOKE_STUDENT}', false)`);
  await db.query(
    `select set_config('request.headers', '{"x-forwarded-for":"203.0.113.12"}', false)`
  );
  await db.exec(`set role authenticated`);
  try {
    const afterRevoke = await db.query(
      `select public.get_public_certificate('${certNumber}') as r`
    );
    const row = afterRevoke.rows[0].r;
    if (row.found !== true || row.status !== 'revoked') {
      fail('a revoked certificate does not report as revoked on the verification page');
    }
    if (row.revoked_reason !== 'Issued to the wrong learner') {
      fail('the verification page does not show why the certificate was revoked');
    }
    console.log('  PASS  a revoked certificate reports as revoked, with the reason');
  } finally {
    await db.exec(`reset role`);
  }

  // ---- Phase 10: releasing a marked paper issues the certificate ----
  //
  // The release happened further up this file. Whether it left a certificate
  // behind depends on the auto_issue_certificates setting, so both are checked
  // here, after `reset role`, where the certificates table can be read plainly.

  const autoSetting = await db.query(
    `select value from public.system_settings where key = 'auto_issue_certificates'`
  );
  if (!autoSetting.rows[0]) {
    fail('the auto_issue_certificates setting does not exist, so release can never issue');
  }

  const releasedPaper = await db.query(
    `select ts.user_id, a.course_id
     from public.theory_submissions ts
     join public.assessments a on a.id = ts.assessment_id
     where ts.id = '${submissionId}'::uuid`
  );
  const issuedFor = await db.query(
    `select count(*)::int as n from public.certificates
     where user_id = '${releasedPaper.rows[0].user_id}'
       and course_id = '${releasedPaper.rows[0].course_id}'`
  );
  if (Number(issuedFor.rows[0].n) < 1) {
    const why = await db.query(
      `select public.certificate_eligible('${releasedPaper.rows[0].user_id}', '${releasedPaper.rows[0].course_id}') as r`
    );
    fail(
      `releasing the paper issued no certificate; eligibility says ${JSON.stringify(why.rows[0].r)}`
    );
  }
  console.log('  PASS  releasing a marked paper issues the certificate automatically');

  // ---- Phase 10: the practical requirement in certificate_eligible ----
  //
  // Off by default, so turning it on is the only thing that can change who qualifies.

  const courseRow = await db.query(`select id from public.courses where code = 'SMOKE'`);
  const smokeCourse = courseRow.rows[0].id;

  const before = await db.query(
    `select public.certificate_eligible('${SMOKE_STUDENT}', '${smokeCourse}') as r`
  );
  if (before.rows[0].r.practicals?.required !== false) {
    fail('practicals are required for a certificate by default');
  }
  console.log('  PASS  practical activities do not gate a certificate by default');

  await db.exec(`
    insert into public.system_settings (key, value, description, is_secret)
    values ('require_practicals', 'true', 'test', false)
    on conflict (key) do update set value = 'true';

    insert into public.practical_activities (course_id, title, is_required, status)
    values ('${smokeCourse}', 'SMOKE required practical', true, 'published');
  `);

  const withEmpty = await db.query(
    `select public.certificate_eligible('${SMOKE_STUDENT}', '${smokeCourse}') as r`
  );
  const emptyBlock = withEmpty.rows[0].r.practicals;
  if (Number(emptyBlock.total) !== 1 || Number(emptyBlock.done) !== 0) {
    fail('an ungraded required practical was not reported as outstanding');
  }

  await db.exec(`
    insert into public.practical_submissions (activity_id, user_id, body, status, score)
    select pa.id, '${SMOKE_STUDENT}', 'my work', 'graded', 6
    from public.practical_activities pa
    where pa.title = 'SMOKE required practical';
  `);
  const tooLow = await db.query(
    `select public.certificate_eligible('${SMOKE_STUDENT}', '${smokeCourse}') as r`
  );
  if (Number(tooLow.rows[0].r.practicals.done) !== 0) {
    fail('a practical graded below the pass mark counted towards the certificate');
  }

  await db.exec(`
    update public.practical_submissions set score = 9
    where user_id = '${SMOKE_STUDENT}'
      and activity_id in (select id from public.practical_activities where title = 'SMOKE required practical');
  `);
  const passed = await db.query(
    `select public.certificate_eligible('${SMOKE_STUDENT}', '${smokeCourse}') as r`
  );
  if (Number(passed.rows[0].r.practicals.done) !== 1) {
    fail('a practical graded at or above the pass mark did not count towards the certificate');
  }

  await db.exec(`delete from public.system_settings where key = 'require_practicals'`);
  await db.exec(`
    delete from public.practical_activities where title = 'SMOKE required practical'
  `);
  console.log('  PASS  a required practical must be graded at the pass mark to qualify');

  console.log('');
  console.log('Combined file (exactly what db:push sends to your project)');
  const combinedPath = join(root, 'supabase', 'combined_migrations.sql');
  let combinedSql;
  try {
    combinedSql = readFileSync(combinedPath, 'utf8');
  } catch {
    fail('supabase/combined_migrations.sql is missing — run: node scripts/combine-sql.mjs');
  }
  const combined = await PGlite.create();
  try {
    await combined.exec(PRELUDE);
    await combined.exec(combinedSql);
    console.log('  PASS  combined_migrations.sql applies cleanly to an empty database');
    await combined.exec(combinedSql);
    console.log('  PASS  combined_migrations.sql is idempotent (second run)');
  } catch (e) {
    fail(`combined_migrations.sql — ${e.message}`);
  } finally {
    await combined.close();
  }

  console.log('');
  console.log('All migrations valid.');
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('FATAL:', e.message);
    process.exit(1);
  });
}
