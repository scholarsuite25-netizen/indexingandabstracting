#!/usr/bin/env node
// LIS 815 LMS — Row Level Security test suite.
// Run AFTER migrations are applied:  npm run test:rls
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  try {
    const text = readFileSync(resolve(root, '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v && !process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* no .env.local yet */
  }
}

loadEnv();

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.log('');
  console.log('Missing Supabase credentials in .env.local.');
  console.log('1. Create your free project at https://supabase.com');
  console.log('2. Copy Project URL, anon key and service_role key into .env.local');
   console.log('3. Run  npm run db:push');
  console.log('4. Run this again:  npm run test:rls');
  console.log('');
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
  }
}

function errMsg(r) {
  return r.error ? r.error.message : '';
}

const stamp = Date.now();
const PW = 'RlsTest!2026';
const emailA = `rls-a-${stamp}@example.com`;
const emailB = `rls-b-${stamp}@example.com`;
const emailC = `rls-c-${stamp}@example.com`;
const emailI = `rls-i-${stamp}@example.com`;

const ids = {};

async function createUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id;
}

async function signIn(email) {
  const client = createClient(URL_, ANON, { auth: { persistSession: true } });
  const { error } = await client.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return client;
}

async function setup() {
  const ins = async (table, row) => {
    const { data, error } = await admin.from(table).insert(row).select().single();
    if (error) throw new Error(`setup ${table}: ${error.message}`);
    return data;
  };

  ids.course = await ins('courses', {
    code: `RLS-TEST-${stamp}`,
    title: 'RLS Test Course',
    status: 'published',
    enrolment_open: true,
  });
  ids.course2 = await ins('courses', {
    code: `RLS-TEST2-${stamp}`,
    title: 'RLS Second Course',
    status: 'published',
    enrolment_open: true,
  });
  ids.module = await ins('modules', { course_id: ids.course.id, position: 1, title: 'Module 1' });
  ids.chapter = await ins('chapters', { module_id: ids.module.id, position: 1, title: 'Chapter 1', slug: 'chapter-1' });

  ids.lesson1 = await ins('lessons', {
    chapter_id: ids.chapter.id,
    position: 1,
    title: 'Lesson 1: Indexing basics',
    kind: 'reading',
    is_required: true,
    required_reading_pct: 90,
    status: 'published',
  });
  ids.lesson2 = await ins('lessons', {
    chapter_id: ids.chapter.id,
    position: 2,
    title: 'Lesson 2: Abstracting basics',
    kind: 'reading',
    is_required: true,
    required_reading_pct: 90,
    status: 'published',
  });
  await admin.from('lesson_prerequisites').insert({
    lesson_id: ids.lesson2.id,
    prerequisite_lesson_id: ids.lesson1.id,
  });
  await ins('lesson_sections', {
    lesson_id: ids.lesson1.id,
    position: 1,
    kind: 'prose',
    title: 'Intro',
    content_md: 'Indexing is the process of organizing information for retrieval.',
    estimated_words: 10,
  });
  await ins('lesson_sections', {
    lesson_id: ids.lesson2.id,
    position: 1,
    kind: 'prose',
    title: 'Intro',
    content_md: 'Abstracting summarizes documents in brief.',
    estimated_words: 10,
  });

  ids.objective = await ins('assessments', {
    course_id: ids.course.id,
    type: 'objective',
    title: 'Objective Test',
    status: 'published',
    pass_mark: 50,
    max_attempts: 5,
  });
  ids.objQuestion = await ins('questions', {
    assessment_id: ids.objective.id,
    stem_md: 'What is indexing?',
    type: 'mcq',
    points: 1,
    position: 1,
    status: 'published',
    explanation_md: 'Because organizing information enables retrieval.',
  });
  ids.optA = await ins('question_options', {
    question_id: ids.objQuestion.id,
    label: 'A',
    text: 'Organizing information for retrieval',
    position: 1,
    is_correct: true,
  });
  ids.optB = await ins('question_options', {
    question_id: ids.objQuestion.id,
    label: 'B',
    text: 'Deleting information',
    position: 2,
    is_correct: false,
  });

  ids.theory = await ins('assessments', {
    course_id: ids.course.id,
    type: 'theory',
    title: 'Theory Examination',
    status: 'published',
    duration_minutes: 120,
  });
  ids.theoryQuestions = [];
  for (let i = 1; i <= 7; i++) {
    const q = await ins('questions', {
      assessment_id: ids.theory.id,
      stem_md: `Theory question ${i}: discuss with examples.`,
      type: 'essay',
      points: 20,
      position: i,
      status: 'published',
      model_answer_md: 'SECRET-MODEL-ANSWER',
    });
    ids.theoryQuestions.push(q.id);
  }

  ids.userA = await createUser(emailA);
  ids.userB = await createUser(emailB);
  ids.userC = await createUser(emailC);
  ids.userI = await createUser(emailI);

  await admin.from('course_staff').insert({
    course_id: ids.course.id,
    user_id: ids.userI,
    staff_role: 'instructor',
  });
}

async function main() {
  console.log('LIS 815 LMS — RLS test suite');
  console.log(`Target: ${URL_}`);
  console.log('');

  await setup();

  let A = await signIn(emailA);
  let B = await signIn(emailB);
  let C = await signIn(emailC);
  let I = await signIn(emailI);

  console.log('Anonymous access');
  await test('anon cannot read profiles', async () => {
    const { data } = await anon.from('profiles').select('id');
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });
  await test('anon cannot read courses', async () => {
    const { data } = await anon.from('courses').select('id');
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });

  console.log('Accounts and profile privacy');
  await test('student A has a profile and the student role', async () => {
    const { data: p } = await A.from('profiles').select('id, email').eq('id', ids.userA);
    assert(p && p.length === 1, 'profile missing');
    const { data: r } = await A.from('user_roles').select('role_id, roles(code)').eq('user_id', ids.userA);
    assert(r && r.length === 1 && r[0].roles?.code === 'student', 'student role missing');
  });
  await test('student A cannot read student B profile', async () => {
    const { data } = await A.from('profiles').select('id').eq('id', ids.userB);
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });
  await test('student A cannot change their own role', async () => {
    const { data: adminRole } = await admin.from('roles').select('id').eq('code', 'admin').single();
    const { data } = await A.from('user_roles').update({ role_id: adminRole.id }).eq('user_id', ids.userA).select();
    assert(!data || data.length === 0, 'role update should affect 0 rows');
    const { data: r } = await A.from('user_roles').select('roles(code)').eq('user_id', ids.userA);
    assert(r?.[0]?.roles?.code === 'student', 'role changed!');
  });

  console.log('Enrolment and lesson gating');
  await test('student A sees the published course', async () => {
    const { data } = await A.from('courses').select('id').eq('id', ids.course.id);
    assert(data && data.length === 1, 'course not visible');
  });
  await test('student A enrols themselves', async () => {
    const { data, error } = await A.rpc('enroll_self', { p_course_id: ids.course.id });
    assert(!error, errMsg({ error }));
    assert(typeof data === 'string', 'expected enrolment id');
  });
  await test('student C enrols themselves', async () => {
    const { data, error } = await C.rpc('enroll_self', { p_course_id: ids.course.id });
    assert(!error, errMsg({ error }));
    assert(typeof data === 'string', 'expected enrolment id');
  });
  await test('student A sees both lessons', async () => {
    const { data } = await A.from('lessons').select('id').order('position');
    assert(data && data.length === 2, `expected 2 lessons, got ${data?.length}`);
  });
  await test('student A only sees lesson 1 content (prerequisite gating)', async () => {
    const { data } = await A.from('lesson_sections').select('lesson_id');
    assert(data && data.length === 1 && data[0].lesson_id === ids.lesson1.id, 'prerequisite gating failed');
  });
  await test('student B (not enrolled) sees no lessons', async () => {
    const { data } = await B.from('lessons').select('id');
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });
  await test('completing lesson 1 before reading 90% is rejected', async () => {
    await A.rpc('record_reading_event', { p_lesson_id: ids.lesson1.id, p_pct: 50, p_seconds: 30 });
    const { error } = await A.rpc('mark_lesson_complete', { p_lesson_id: ids.lesson1.id });
    assert(error && /Read at least/.test(error.message), `expected read-percentage error, got: ${error?.message}`);
  });
  await test('completing lesson 1 after reading 90% succeeds', async () => {
    const { error } = await A.rpc('record_reading_event', { p_lesson_id: ids.lesson1.id, p_pct: 95, p_seconds: 60 });
    assert(!error, errMsg({ error }));
    const { error: e2 } = await A.rpc('mark_lesson_complete', { p_lesson_id: ids.lesson1.id });
    assert(!e2, errMsg({ error: e2 }));
  });
  await test('lesson 2 content unlocks after lesson 1 completes', async () => {
    const { data } = await A.from('lesson_sections').select('lesson_id');
    assert(data && data.length === 2, `expected 2 sections, got ${data?.length}`);
  });
  await test('objective exam stays locked until all required lessons are done', async () => {
    const { error } = await C.rpc('start_objective_attempt', { p_assessment_id: ids.objective.id });
    assert(error && /required lessons/.test(error.message), `expected prerequisite error, got: ${error?.message}`);
  });
  await test('student A completes lesson 2', async () => {
    const { error } = await A.rpc('record_reading_event', { p_lesson_id: ids.lesson2.id, p_pct: 95, p_seconds: 60 });
    assert(!error, errMsg({ error }));
    const { error: e2 } = await A.rpc('mark_lesson_complete', { p_lesson_id: ids.lesson2.id });
    assert(!e2, errMsg({ error: e2 }));
  });
  await test('student cannot write lesson_progress directly', async () => {
    const { data } = await A.from('lesson_progress')
      .update({ reading_pct: 100 })
      .eq('lesson_id', ids.lesson1.id)
      .select();
    assert(!data || data.length === 0, 'direct update should affect 0 rows');
    const { data: after } = await A.from('lesson_progress').select('reading_pct').eq('lesson_id', ids.lesson1.id).single();
    assert(after && after.reading_pct === 95, `reading_pct was tampered: ${after?.reading_pct}`);
  });
  await test('student cannot insert into course_enrollments directly', async () => {
    const { error } = await A.from('course_enrollments').insert({ course_id: ids.course2.id, user_id: ids.userA });
    assert(error && /row-level security/i.test(error.message), `expected RLS error, got: ${error?.message}`);
  });

  console.log('Answer secrecy');
  await test('student A cannot read the questions table', async () => {
    const { data } = await A.from('questions').select('id');
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });
  await test('student A cannot read the question_options table', async () => {
    const { data } = await A.from('question_options').select('id');
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });
  await test('theory question RPC never exposes model answers', async () => {
    const { data, error } = await A.rpc('get_theory_questions', { p_assessment_id: ids.theory.id });
    assert(!error, errMsg({ error }));
    assert(data.questions?.length === 7, `expected 7 questions, got ${data?.questions?.length}`);
    assert(!JSON.stringify(data).includes('SECRET'), 'model answer leaked!');
  });
  await test('student C is blocked from theory exam at < 70% objective', async () => {
    const { error } = await C.rpc('create_theory_submission', { p_assessment_id: ids.theory.id });
    assert(error && /unlocks at 70/.test(error.message), `expected unlock error, got: ${error?.message}`);
  });

  console.log('Objective attempt integrity');
  let attemptId;
  await test('student A starts an attempt', async () => {
    const { data, error } = await A.rpc('start_objective_attempt', { p_assessment_id: ids.objective.id });
    assert(!error, errMsg({ error }));
    assert(typeof data === 'string', 'expected attempt id');
    attemptId = data;
  });
  await test('student A cannot set is_correct themselves', async () => {
    const { error } = await A.from('attempt_answers').insert({
      attempt_id: attemptId,
      question_id: ids.objQuestion.id,
      selected_option_id: ids.optA.id,
      is_correct: true,
    });
    assert(error && /calculated by the server/.test(error.message), `expected server-side error, got: ${error?.message}`);
  });
  await test('student A records their answer', async () => {
    const { error } = await A.from('attempt_answers').insert({
      attempt_id: attemptId,
      question_id: ids.objQuestion.id,
      selected_option_id: ids.optA.id,
    });
    assert(!error, errMsg({ error }));
  });
  await test('submitting marks the attempt server-side (100%)', async () => {
    const { data, error } = await A.rpc('submit_objective_attempt', { p_attempt_id: attemptId });
    assert(!error, errMsg({ error }));
    assert(Number(data.percentage) === 100, `expected 100%, got ${data.percentage}`);
    assert(data.passed === true, 'expected passed = true');
  });
  await test('results reveal the correct option only after marking', async () => {
    const { data, error } = await A.rpc('get_attempt_results', { p_attempt_id: attemptId });
    assert(!error, errMsg({ error }));
    assert(data.show_correct_answers === true, 'show_correct_answers missing');
    assert(data.questions[0]?.correct_option_label === 'A', 'correct option not revealed');
  });
  await test('student B cannot read student A attempt', async () => {
    const { data } = await B.from('assessment_attempts').select('id').eq('id', attemptId);
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });

  console.log('Theory examination rules');
  let submissionId;
  await test('theory exam opens for A after objective pass', async () => {
    const { data, error } = await A.rpc('create_theory_submission', { p_assessment_id: ids.theory.id });
    assert(!error, errMsg({ error }));
    assert(typeof data === 'string', 'expected submission id');
    submissionId = data;
  });
  await test('selecting 4 questions is rejected (exactly 5 required)', async () => {
    const { error } = await A.rpc('select_theory_questions', {
      p_submission_id: submissionId,
      p_question_ids: ids.theoryQuestions.slice(0, 4),
    });
    assert(error && /exactly 5/.test(error.message), `expected exactly-5 error, got: ${error?.message}`);
  });
  await test('selecting 5 questions succeeds', async () => {
    const { error } = await A.rpc('select_theory_questions', {
      p_submission_id: submissionId,
      p_question_ids: ids.theoryQuestions.slice(0, 5),
    });
    assert(!error, errMsg({ error }));
  });
  await test('submitting with empty answers is rejected', async () => {
    const { error } = await A.rpc('submit_theory_submission', { p_submission_id: submissionId });
    assert(error && /needs an answer/.test(error.message), `expected empty-answer error, got: ${error?.message}`);
  });
  await test('submitting with 5 written answers succeeds', async () => {
    // Every theory write goes through save_theory_answer(): a direct UPDATE from the
    // learner matches no rows, so the answers have to be written the honest way.
    const { data: direct } = await A.from('theory_answers')
      .update({ answer_text: 'written around the server' })
      .eq('submission_id', submissionId)
      .eq('status', 'draft')
      .select();
    assert(!direct || direct.length === 0, 'a direct UPDATE changed an answer row');

    const { data: answers, error: readErr } = await A.from('theory_answers')
      .select('id')
      .eq('submission_id', submissionId)
      .eq('status', 'draft');
    assert(!readErr, errMsg({ error: readErr }));
    assert(answers?.length === 5, `expected 5 selected answers, got ${answers?.length}`);

    for (const answer of answers) {
      const { error } = await A.rpc('save_theory_answer', {
        p_answer_id: answer.id,
        p_text: 'This is my answer to the theory question.',
      });
      assert(!error, errMsg({ error }));
    }
    const { error: e2 } = await A.rpc('submit_theory_submission', { p_submission_id: submissionId });
    assert(!e2, errMsg({ error: e2 }));
  });
  await test('submitted theory answers become read-only', async () => {
    const { data } = await A.from('theory_answers')
      .update({ answer_text: 'tampered' })
      .eq('submission_id', submissionId)
      .select();
    assert(!data || data.length === 0, 'submitted answers should not be editable');
  });

  console.log('Settings, audit and notification privacy');
  await test('secret settings are invisible to students', async () => {
    const { data } = await A.from('system_settings').select('key').eq('key', 'email_api_key');
    assert(!data || data.length === 0, 'secret setting leaked');
  });
  await test('public settings are visible to students', async () => {
    const { data } = await A.from('system_settings').select('key').eq('key', 'theory_pass_mark');
    assert(data && data.length === 1, 'public setting missing');
  });
  await test('students cannot change settings', async () => {
    const { data } = await A.from('system_settings').update({ value: 999 }).eq('key', 'theory_pass_mark').select();
    assert(!data || data.length === 0, 'settings update should affect 0 rows');
  });
  await test('students cannot read audit logs', async () => {
    const { data } = await A.from('audit_logs').select('id');
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });
  await test('notifications are private to their owner', async () => {
    await admin.from('notifications').insert({ user_id: ids.userB, type: 'test', title: 'For B only' });
    const { data: seenByA } = await A.from('notifications').select('id').eq('user_id', ids.userB);
    assert(!seenByA || seenByA.length === 0, 'A read B notifications');
    const { data: seenByB } = await B.from('notifications').select('id').eq('user_id', ids.userB);
    assert(seenByB && seenByB.length === 1, 'B cannot see own notification');
  });

  console.log('Notes privacy');
  await test('notes are visible only to their author', async () => {
    await A.from('notes').insert({ user_id: ids.userA, lesson_id: ids.lesson1.id, body: 'private note' });
    const { data: seenByB } = await B.from('notes').select('id');
    assert(!seenByB || seenByB.length === 0, 'B read A notes');
    const { data: seenByA } = await A.from('notes').select('id');
    assert(seenByA && seenByA.length === 1, 'A cannot see own note');
  });

  console.log('Instructor (non-admin staff) content access');
  await test('instructor can read questions', async () => {
    const { data } = await I.from('questions').select('id');
    assert(data && data.length >= 8, `expected >= 8 questions, got ${data?.length}`);
  });
  await test('instructor can create a chapter', async () => {
    const { error } = await I.from('chapters').insert({
      module_id: ids.module.id,
      position: 2,
      title: 'Chapter 2 (instructor)',
      slug: 'chapter-2',
    });
    assert(!error, errMsg({ error }));
  });
  await test('instructor can create a lesson', async () => {
    const { data: ch } = await I.from('chapters').select('id').eq('slug', 'chapter-2').single();
    const { error } = await I.from('lessons').insert({
      chapter_id: ch.id,
      position: 1,
      title: 'Instructor lesson',
      status: 'draft',
    });
    assert(!error, errMsg({ error }));
  });
  await test('instructor can create a question', async () => {
    const { error } = await I.from('questions').insert({
      assessment_id: ids.objective.id,
      stem_md: 'Instructor created question',
      type: 'mcq',
      position: 9,
      status: 'draft',
    });
    assert(!error, errMsg({ error }));
  });
  await test('student A cannot create questions', async () => {
    const { error } = await A.from('questions').insert({
      assessment_id: ids.objective.id,
      stem_md: 'forged',
      type: 'mcq',
      position: 10,
    });
    assert(error && /row-level security/i.test(error.message), `expected RLS error, got: ${error?.message}`);
  });

  console.log('Database invariants');
  await test('a question cannot have two correct options', async () => {
    const { error } = await admin.from('question_options').insert({
      question_id: ids.objQuestion.id,
      label: 'C',
      text: 'Another correct one',
      position: 3,
      is_correct: true,
    });
    assert(error && /only one correct option/i.test(error.message), `expected trigger error, got: ${error?.message}`);
  });

  console.log('Search');
  await test('enrolled student finds lessons via search', async () => {
    const { data, error } = await A.rpc('search_content', { p_query: 'indexing' });
    assert(!error, errMsg({ error }));
    assert(data && data.length >= 1, 'expected search results');
    assert(data.some((r) => r.entity_type === 'lesson'), 'lesson result missing');
  });
  await test('non-enrolled student gets no lesson results', async () => {
    const { data, error } = await B.rpc('search_content', { p_query: 'indexing' });
    assert(!error, errMsg({ error }));
    assert(!data || data.length === 0, `expected 0 rows, got ${data?.length}`);
  });

  console.log('Cleanup');
  for (const uid of [ids.userA, ids.userB, ids.userC, ids.userI]) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) console.log(`  WARN  could not delete user ${uid}: ${error.message}`);
  }
  const { error: delCourse } = await admin.from('courses').delete().in('id', [ids.course.id, ids.course2.id]);
  if (delCourse) console.log(`  WARN  could not delete test courses: ${delCourse.message}`);
  const { error: delAudit } = await admin
    .from('audit_logs')
    .delete()
    .in('entity_id', [ids.lesson1.id, ids.lesson2.id, ids.objective.id]);
  if (delAudit) console.log(`  WARN  could not delete test audit rows: ${delAudit.message}`);

  console.log('');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
