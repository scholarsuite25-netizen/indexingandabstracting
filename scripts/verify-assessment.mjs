#!/usr/bin/env node
// LIS 815 LMS - assessment engine verification (Phase 6).
// Proves the exam rules against the live Supabase project in .env.local:
//   npm run test:assessment
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// The service role is used only to stand in for a learner who has already done the
// reading (completing 28 lessons is not what this script is testing) and to build a
// throwaway paper for the timed-attempt tests.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    const text = readFileSync(resolve(root, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
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
  console.log("");
  console.log("Missing Supabase credentials in .env.local.");
  console.log("Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and");
  console.log("SUPABASE_SERVICE_ROLE_KEY, apply the migrations, seed, then run again.");
  console.log("");
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
const failures = [];
const cleanup = [];

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function message(result) {
  return result.error ? result.error.message : "";
}

const stamp = Date.now();
const PW = "AssessmentTest!2026";
const email = `assessment-${stamp}@example.com`;
const otherEmail = `assessment-other-${stamp}@example.com`;

async function createUser(address) {
  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    password: PW,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  cleanup.push(() => admin.auth.admin.deleteUser(data.user.id).catch(() => {}));
  return data.user.id;
}

async function learnerClient(address) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: address, password: PW });
  if (error) throw new Error(`signIn: ${error.message}`);
  return client;
}

async function main() {
  console.log("LIS 815 LMS — assessment engine verification");

  const { data: course } = await admin
    .from("courses")
    .select("id, code, enrolment_open")
    .eq("code", "LIS 815")
    .maybeSingle();
  if (!course) {
    console.log("");
    console.log("No LIS 815 course in the database yet.");
    console.log("Run  npm run db:push  to apply the migrations, then  npm run db:seed  to load the course.");
    process.exit(1);
  }
  if (!course.enrolment_open) {
    console.log("");
    console.log("Course enrolment is closed — set courses.enrolment_open = true and re-run.");
    process.exit(1);
  }

  const { data: objectivePaper } = await admin
    .from("assessments")
    .select("id, title, pass_mark, max_attempts, duration_minutes")
    .eq("course_id", course.id)
    .eq("type", "objective")
    .maybeSingle();
  if (!objectivePaper) {
    console.log("");
    console.log("No objective assessment seeded — run:  npm run db:seed");
    process.exit(1);
  }

  const userId = await createUser(email);
  const learner = await learnerClient(email);
  const { error: enrolError } = await learner.rpc("enroll_self", { p_course_id: course.id });
  assert(!enrolError, `enrol_self: ${enrolError?.message}`);

  const { data: checkLessons } = await admin
    .from("lessons")
    .select("id, title, required_assessment_id, required_assessment_min_score")
    .eq("kind", "check")
    .not("required_assessment_id", "is", null)
    .limit(1);
  const checkLesson = checkLessons?.[0];
  assert(checkLesson?.required_assessment_id, "no knowledge check lesson is linked to an assessment");

  const { data: checkQuestions } = await admin
    .from("questions")
    .select("id, position, question_options ( id, label, is_correct )")
    .eq("assessment_id", checkLesson.required_assessment_id)
    .eq("status", "published")
    .order("position");
  assert(checkQuestions?.length > 0, "the knowledge check has no questions");

  // A wrong option and a right one, per question, resolved as the service role because
  // a learner cannot read question_options at all.
  const keyFor = (questionId) =>
    checkQuestions
      .find((q) => q.id === questionId)
      .question_options.find((o) => o.is_correct);
  const wrongFor = (questionId) =>
    checkQuestions
      .find((q) => q.id === questionId)
      .question_options.find((o) => !o.is_correct);

  // The service role stands in for the reading: complete every lesson upstream of this
  // knowledge check, so mark_lesson_complete() judges the check itself and not the chain.
  // The objective paper stays gated — it wants every required lesson.
  const chain = [];
  let cursor = checkLesson.id;
  for (let step = 0; step < 60 && cursor; step += 1) {
    const { data: row } = await admin
      .from("lesson_prerequisites")
      .select("prerequisite_lesson_id")
      .eq("lesson_id", cursor)
      .limit(1)
      .maybeSingle();
    if (!row?.prerequisite_lesson_id) break;
    cursor = row.prerequisite_lesson_id;
    chain.push(cursor);
  }
  for (const lessonId of chain.reverse()) {
    const { error } = await admin.from("lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        status: "completed",
        reading_pct: 100,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    assert(!error, `completing a prerequisite lesson: ${message({ error })}`);
  }

  console.log(
    `  course ${course.id} · objective "${objectivePaper.title}" · knowledge check with ${checkQuestions.length} questions`,
  );

  // ---------------------------------------------------------------------------
  console.log("\nAssessment centre");
  // ---------------------------------------------------------------------------
  await test("the centre lists the objective paper with its question count", async () => {
    const { data, error } = await learner.rpc("assessment_centre", { p_course_id: course.id });
    assert(!error, message({ error }));
    const paper = data.assessments.find((a) => a.type === "objective");
    assert(paper, "the objective paper was not listed");
    assert(paper.question_count >= 100, `only ${paper.question_count} questions counted`);
    assert(Array.isArray(paper.attempts), "the centre returned no attempt history");
  });

  await test("the centre does not hand out question or option text", async () => {
    const { data, error } = await learner.rpc("assessment_centre", { p_course_id: course.id });
    assert(!error, message({ error }));
    assert(!JSON.stringify(data).includes("stem_md"), "the centre leaked question text");
  });

  await test("a learner cannot read the question bank directly", async () => {
    const { data, error } = await learner.from("questions").select("id").limit(1);
    assert(!error, message({ error }));
    assert(!data || data.length === 0, "a learner read the questions table");
  });

  await test("a learner cannot read the correct answers directly", async () => {
    const { data, error } = await learner
      .from("question_options")
      .select("id, is_correct")
      .limit(1);
    assert(!error, message({ error }));
    assert(!data || data.length === 0, "a learner read question_options");
  });

  // ---------------------------------------------------------------------------
  console.log("\nThe objective paper is gated on the lessons");
  // ---------------------------------------------------------------------------
  await test("starting it before the required lessons is refused, and says why", async () => {
    const { error } = await learner.rpc("start_objective_attempt", {
      p_assessment_id: objectivePaper.id,
    });
    assert(error, "the objective paper started with no lessons completed");
    assert(/required lessons/i.test(error.message), `unexpected reason: ${error.message}`);
  });

  await test("another learner cannot read its centre", async () => {
    await createUser(otherEmail);
    const other = await learnerClient(otherEmail);
    const { error } = await other.rpc("assessment_centre", { p_course_id: course.id });
    assert(error, "a non-enrolled learner read the centre");
    assert(/not enrolled/i.test(error.message), `unexpected reason: ${error.message}`);
  });

  // The gate is checked while this learner still has no objective attempt of their own —
  // the timed paper below is also an objective attempt, so the check has to come first.
  await test("before any attempt the gate says so, not that the score is too low", async () => {
    const { data, error } = await learner.rpc("theory_eligibility", { p_course_id: course.id });
    assert(!error, message({ error }));
    assert(data.state === "not_attempted", `state is ${data.state}`);
    assert(data.threshold === 70, `threshold is ${data.threshold}`);
    assert(/sit the objective assessment first/i.test(data.reason), `unclear reason: ${data.reason}`);
  });

  // ---------------------------------------------------------------------------
  console.log("\nThe knowledge check gates its lesson");
  // ---------------------------------------------------------------------------
  let checkAttemptId = null;

  await test("the check starts and returns a paper with the saved choices", async () => {
    const { data, error } = await learner.rpc("start_objective_attempt", {
      p_assessment_id: checkLesson.required_assessment_id,
    });
    assert(!error, message({ error }));
    checkAttemptId = data;

    const snap = await learner.rpc("get_attempt_snapshot", { p_attempt_id: checkAttemptId });
    assert(!snap.error, message(snap));
    assert(snap.data.questions.length === checkQuestions.length, "the paper is short");
    assert(
      snap.data.questions.every((q) => "selected_option_id" in q),
      "the snapshot does not report saved choices, so a reload would lose them",
    );
    assert(
      snap.data.questions.every((q) => q.options.every((o) => !("is_correct" in o))),
      "the live paper leaked is_correct",
    );
  });

  await test("starting again resumes the same attempt instead of burning a new one", async () => {
    const { data } = await learner.rpc("start_objective_attempt", {
      p_assessment_id: checkLesson.required_assessment_id,
    });
    assert(data === checkAttemptId, "a second attempt was created instead of resuming");
  });

  await test("an option from another question is refused", async () => {
    const first = checkQuestions[0];
    const other = wrongFor(checkQuestions[1].id);
    const { error } = await learner.rpc("save_answer", {
      p_attempt_id: checkAttemptId,
      p_question_id: first.id,
      p_selected_option_id: other.id,
    });
    assert(error, "an answer pointing at another question's option was accepted");
  });

  await test("a question that is not on the paper is refused", async () => {
    const { data: stranger } = await admin
      .from("questions")
      .select("id")
      .eq("assessment_id", objectivePaper.id)
      .limit(1)
      .maybeSingle();
    const { error } = await learner.rpc("save_answer", {
      p_attempt_id: checkAttemptId,
      p_question_id: stranger.id,
      p_selected_option_id: keyFor(checkQuestions[0].id).id,
    });
    assert(error, "a question from another paper was accepted");
  });

  await test("answers save and the count follows", async () => {
    for (const question of checkQuestions) {
      const { error } = await learner.rpc("save_answer", {
        p_attempt_id: checkAttemptId,
        p_question_id: question.id,
        p_selected_option_id: wrongFor(question.id).id,
      });
      assert(!error, message({ error }));
    }
    const snap = await learner.rpc("get_attempt_snapshot", { p_attempt_id: checkAttemptId });
    assert(snap.data.answered_count === checkQuestions.length, "answered_count is wrong");
    assert(
      snap.data.questions.every((q) => q.selected_option_id),
      "a saved choice was not returned by the snapshot",
    );
  });

  await test("changing an answer replaces it rather than adding a row", async () => {
    const question = checkQuestions[0];
    const { error } = await learner.rpc("save_answer", {
      p_attempt_id: checkAttemptId,
      p_question_id: question.id,
      p_selected_option_id: keyFor(question.id).id,
    });
    assert(!error, message({ error }));

    const { count } = await admin
      .from("attempt_answers")
      .select("id", { count: "exact", head: true })
      .eq("attempt_id", checkAttemptId);
    assert(
      count === checkQuestions.length,
      `expected ${checkQuestions.length} rows, the change added one (${count})`,
    );

    const snap = await learner.rpc("get_attempt_snapshot", { p_attempt_id: checkAttemptId });
    const entry = (snap.data.questions ?? []).find((q) => q.id === question.id);
    assert(entry, "the changed question is missing from the snapshot");
    assert(
      entry.selected_option_id === keyFor(question.id).id,
      `the new choice was not stored (still ${entry.selected_option_id})`,
    );
  });

  await test("a learner cannot write is_correct themselves", async () => {
    const { error } = await learner
      .from("attempt_answers")
      .update({ is_correct: true })
      .eq("attempt_id", checkAttemptId);
    assert(error, "a learner marked their own answers correct");
  });

  await test("failing the check does not complete the lesson", async () => {
    // Make it a clean fail: every answer wrong.
    for (const question of checkQuestions) {
      const { error } = await learner.rpc("save_answer", {
        p_attempt_id: checkAttemptId,
        p_question_id: question.id,
        p_selected_option_id: wrongFor(question.id).id,
      });
      assert(!error, message({ error }));
    }
    const { data, error } = await learner.rpc("submit_objective_attempt", {
      p_attempt_id: checkAttemptId,
    });
    assert(!error, message({ error }));
    assert(data.passed === false, `a fully wrong paper was marked as passed (${data.percentage}%)`);

    const done = await learner.rpc("mark_lesson_complete", { p_lesson_id: checkLesson.id });
    assert(done.error, "the lesson completed without passing its knowledge check");
    assert(/knowledge check/i.test(done.error.message), `unexpected reason: ${done.error.message}`);
  });

  await test("the check shows the right answers afterwards", async () => {
    const { data, error } = await learner.rpc("get_attempt_results", {
      p_attempt_id: checkAttemptId,
    });
    assert(!error, message({ error }));
    assert(data.show_correct_answers === true, "the knowledge check withheld the answers");
    assert(
      data.questions.every((q) => q.correct_option_id),
      "a question came back without its correct option",
    );
    assert(data.questions.some((q) => q.is_correct === false), "nothing was marked incorrect");
  });

  await test("a submitted attempt refuses further answers", async () => {
    const { error } = await learner.rpc("save_answer", {
      p_attempt_id: checkAttemptId,
      p_question_id: checkQuestions[0].id,
      p_selected_option_id: keyFor(checkQuestions[0].id).id,
    });
    assert(error, "a closed attempt accepted another answer");
  });

  await test("submitting twice keeps the first score", async () => {
    const first = await learner.rpc("get_attempt_results", { p_attempt_id: checkAttemptId });
    const { data } = await learner.rpc("submit_objective_attempt", {
      p_attempt_id: checkAttemptId,
    });
    assert(data.already_submitted === true, "a second submit was not reported as such");
    const second = await learner.rpc("get_attempt_results", { p_attempt_id: checkAttemptId });
    assert(
      Number(first.data.percentage) === Number(second.data.percentage),
      "a second submit changed the score",
    );
  });

  await test("passing the check completes the lesson and unlocks the next one", async () => {
    const { data: attemptId } = await learner.rpc("start_objective_attempt", {
      p_assessment_id: checkLesson.required_assessment_id,
    });
    const questions = await admin
      .from("questions")
      .select("id, question_options ( id, is_correct )")
      .eq("assessment_id", checkLesson.required_assessment_id)
      .eq("status", "published");
    const need = Number(checkLesson.required_assessment_min_score) / 100;

    for (const [position, question] of (questions.data ?? []).entries()) {
      const options = question.question_options;
      // Answer the first ceil(n * need) correctly, the rest wrongly, so the paper lands
      // exactly on the pass mark rather than comfortably above it.
      const takeCorrect = position < Math.ceil(questions.data.length * need);
      const pick = takeCorrect
        ? options.find((o) => o.is_correct)
        : options.find((o) => !o.is_correct);
      const { error } = await learner.rpc("save_answer", {
        p_attempt_id: attemptId,
        p_question_id: question.id,
        p_selected_option_id: pick.id,
      });
      assert(!error, message({ error }));
    }

    const { data: result, error } = await learner.rpc("submit_objective_attempt", {
      p_attempt_id: attemptId,
    });
    assert(!error, message({ error }));
    assert(result.passed === true, `a correct paper was not passed (${result.percentage}%)`);

    const done = await learner.rpc("mark_lesson_complete", { p_lesson_id: checkLesson.id });
    assert(!done.error, `the lesson stayed locked after a pass: ${message(done)}`);
  });

  // ---------------------------------------------------------------------------
  console.log("\nTiming out");
  // ---------------------------------------------------------------------------
  const timed = await buildTimedPaper(course.id, stamp);
  let timedAttemptId = null;

  await test("an expired attempt reports the expiry instead of raising", async () => {
    timedAttemptId = await startTimed(learner, timed.assessmentId);
    const { error } = await admin
      .from("assessment_attempts")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", timedAttemptId);
    assert(!error, `could not backdate the attempt: ${message({ error })}`);

    const { data, error: saveError } = await learner.rpc("save_answer", {
      p_attempt_id: timedAttemptId,
      p_question_id: timed.questionIds[0],
      p_selected_option_id: timed.correctOptionIds[0],
    });
    assert(!saveError, `save_answer raised instead of reporting: ${message({ error: saveError })}`);
    assert(data.expired === true, "the runner was not told the paper is over");
    assert(data.saved === false, "an answer was stored after the deadline");
  });

  await test("the expired attempt is marked from the answers it did save", async () => {
    const { data: row } = await admin
      .from("assessment_attempts")
      .select("status, percentage, total")
      .eq("id", timedAttemptId)
      .maybeSingle();
    assert(row.status === "expired", `status is ${row.status}`);
    assert(row.total === timed.questionIds.length, "the paper was not scored in full");
    assert(row.percentage !== null, "the expired attempt has no score");
  });

  await test("the result of a timed-out attempt is readable", async () => {
    const { data, error } = await learner.rpc("get_attempt_results", {
      p_attempt_id: timedAttemptId,
    });
    assert(!error, message({ error }));
    assert(data.expired === true, "the result does not say the time ran out");
    assert(data.questions.length === timed.questionIds.length, "the result is missing questions");
  });

  await test("one learner cannot read another's result", async () => {
    const other = await learnerClient(otherEmail);
    const { error } = await other.rpc("get_attempt_results", { p_attempt_id: timedAttemptId });
    assert(error, "another learner read a result");
  });

  // ---------------------------------------------------------------------------
  console.log("\nThe 70% theory gate");
  // ---------------------------------------------------------------------------
  async function setBestPercentage(pct) {
    const { data: existing } = await admin
      .from("assessment_attempts")
      .select("id")
      .eq("assessment_id", objectivePaper.id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const row = {
      assessment_id: objectivePaper.id,
      user_id: userId,
      attempt_no: 1,
      status: "marked",
      question_order: [],
      started_at: new Date().toISOString(),
      expires_at: null,
      submitted_at: new Date().toISOString(),
      marked_at: new Date().toISOString(),
      score: pct,
      total: 100,
      percentage: pct,
      passed: pct >= 70,
    };
    if (existing) {
      const { error } = await admin
        .from("assessment_attempts")
        .update({ score: pct, percentage: pct, passed: pct >= 70 })
        .eq("id", existing.id);
      assert(!error, message({ error }));
    } else {
      const { error } = await admin.from("assessment_attempts").insert(row);
      assert(!error, message({ error }));
    }
  }

  for (const [pct, want] of [
    [0, "below_threshold"],
    [69, "below_threshold"],
    [70, "eligible"],
    [100, "eligible"],
  ]) {
    await test(`${pct}% on the objective paper is ${want}`, async () => {
      await setBestPercentage(pct);
      const { data, error } = await learner.rpc("theory_eligibility", { p_course_id: course.id });
      assert(!error, message({ error }));
      assert(data.state === want, `expected ${want}, got ${data.state}`);
      assert(data.best_percentage === pct, `best score reported as ${data.best_percentage}`);
    });
  }

  await test("an unenrolled learner is told to enrol, not that they scored too low", async () => {
    const other = await learnerClient(otherEmail);
    const { data, error } = await other.rpc("theory_eligibility", { p_course_id: course.id });
    assert(!error, message({ error }));
    assert(data.state === "not_enrolled", `state is ${data.state}`);
  });

  await test("a teacher is never locked out of the gate they are reading", async () => {
    const { data: existing } = await admin
      .from("course_staff")
      .select("user_id")
      .eq("course_id", course.id)
      .limit(1)
      .maybeSingle();

    let staffUserId = existing?.user_id;
    if (!staffUserId) {
      // The seed carries no staff accounts yet, so stand one up for this check.
      const staffId = await createUser(`assessment-staff-${stamp}@example.com`);
      const { error: staffErr } = await admin.from("course_staff").insert({
        course_id: course.id,
        user_id: staffId,
        staff_role: "instructor",
      });
      assert(!staffErr, `could not add a course_staff row: ${message({ error: staffErr })}`);
      staffUserId = staffId;
    }

    const { data, error } = await admin.rpc("theory_eligibility", {
      p_course_id: course.id,
      p_user_id: staffUserId,
    });
    assert(!error, message({ error }));
    assert(data && typeof data.state === "string", "the gate gave no answer for a staff member");
    assert(data.state !== "not_enrolled", `a staff member was told: ${data.reason}`);
  });

  console.log("");
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }

  await admin.from("assessments").delete().eq("id", timed.assessmentId);
  if (failed > 0) process.exit(1);
}
/** A two-question paper with a one-minute clock, built for the timeout tests. */
async function buildTimedPaper(courseId, stamp) {
  const { data: assessment, error } = await admin
    .from("assessments")
    .insert({
      course_id: courseId,
      type: "objective",
      title: `Timed paper ${stamp}`,
      duration_minutes: 1,
      pass_mark: 70,
      max_attempts: 3,
      randomize_questions: true,
      randomize_options: true,
      show_correct_answers: false,
      prerequisite: "none",
      status: "published",
      settings: { source: "verification-script" },
    })
    .select("id")
    .single();
  if (error) throw new Error(`timed paper: ${error.message}`);

  const questionIds = [];
  const correctOptionIds = [];
  for (const n of [1, 2]) {
    const { data: question, error: qError } = await admin
      .from("questions")
      .insert({
        assessment_id: assessment.id,
        stem_md: `Timed question ${n}`,
        type: "mcq",
        points: 1,
        position: n,
        status: "published",
      })
      .select("id")
      .single();
    if (qError) throw new Error(`timed question: ${qError.message}`);
    questionIds.push(question.id);

    for (const [label, isCorrect] of [
      ["A", true],
      ["B", false],
    ]) {
      const { data: option, error: oError } = await admin
        .from("question_options")
        .insert({
          question_id: question.id,
          label,
          text: `option ${label}`,
          position: label === "A" ? 1 : 2,
          is_correct: isCorrect,
        })
        .select("id")
        .single();
      if (oError) throw new Error(`timed option: ${oError.message}`);
      if (isCorrect) correctOptionIds.push(option.id);
    }
  }

  return { assessmentId: assessment.id, questionIds, correctOptionIds };
}

async function startTimed(learner, assessmentId) {
  const { data, error } = await learner.rpc("start_objective_attempt", {
    p_assessment_id: assessmentId,
  });
  if (error) throw new Error(`start timed attempt: ${error.message}`);
  return data;
}

main()
  .catch((e) => {
    console.error("\nVerification could not run:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    for (const job of cleanup) await job().catch(() => {});
  });
