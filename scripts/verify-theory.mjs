#!/usr/bin/env node
// LIS 815 LMS - theory examination verification (Phase 7).
// Walks one paper the whole way through against the live Supabase project in .env.local:
//   npm run test:theory
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// The service role stands in for the two things this script must not fake: a learner who
// has already passed the objective assessment (otherwise the gate is closed and nothing
// downstream can be reached), and a marker with the assessment.grade permission. Every
// action under test is still performed as a signed-in learner or a signed-in marker, over
// the anon key, so the row-level security in front of it is part of what is proved.
//
// Every user and paper created here is deleted at the end.

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

function asArray(result) {
  assert(!result.error, message(result));
  return result.data;
}

const stamp = Date.now();
const PW = "TheoryTest!2026";

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

async function clientFor(address) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: address, password: PW });
  if (error) throw new Error(`signIn: ${error.message}`);
  return client;
}

const ANSWER = (n) =>
  `Indexing and abstracting answer ${n}. A cataloger reads the whole document first, then the ` +
  `title page, the table of contents and any preface, because the preface often states the ` +
  `scope the title only hints at. Keywords are then drawn from the subject headings the ` +
  `cataloger was trained to use, so that a reader searching the catalogue lands on the same ` +
  `document a librarian would hand over.`;

async function main() {
  console.log("LIS 815 LMS — theory examination verification");

  const { data: course } = await admin
    .from("courses")
    .select("id, code")
    .eq("code", "LIS 815")
    .maybeSingle();
  if (!course) {
    console.log("\nNo LIS 815 course yet. Run  npm run db:push  first.");
    process.exit(1);
  }

  const { data: theoryPaper } = await admin
    .from("assessments")
    .select("id, title, pass_mark, settings, status")
    .eq("course_id", course.id)
    .eq("type", "theory")
    .maybeSingle();
  if (!theoryPaper) {
    console.log("\nNo theory assessment seeded — run:  npm run db:seed");
    process.exit(1);
  }

  const { data: questions } = await admin
    .from("questions")
    .select("id, position, points, model_answer_md")
    .eq("assessment_id", theoryPaper.id)
    .eq("status", "published")
    .order("position");
  assert(questions?.length === 7, `the theory paper has ${questions?.length} questions, expected 7`);
  assert(
    questions.some((q) => q.model_answer_md),
    "no question carries a model answer",
  );

  const { data: objectivePaper } = await admin
    .from("assessments")
    .select("id")
    .eq("course_id", course.id)
    .eq("type", "objective")
    .maybeSingle();
  assert(objectivePaper, "no objective assessment to unlock the gate with");

  console.log(`  course ${course.id} · theory "${theoryPaper.title}" · ${questions.length} questions`);

  // ---------------------------------------------------------------------------
  console.log("\nThe gate");
  // ---------------------------------------------------------------------------
  const learnerEmail = `theory-${stamp}@example.com`;
  const otherEmail = `theory-other-${stamp}@example.com`;
  const markerEmail = `theory-marker-${stamp}@example.com`;

  const learnerId = await createUser(learnerEmail);
  const learner = await clientFor(learnerEmail);
  const { error: enrolError } = await learner.rpc("enroll_self", { p_course_id: course.id });
  assert(!enrolError, `enroll_self: ${message({ error: enrolError })}`);
  await createUser(otherEmail);
  const other = await clientFor(otherEmail);

  // The gate opens on a passed objective paper. Standing in for that is exactly the one
  // thing this script is allowed to fake, because 100 questions of multiple choice is not
  // what is under test.
  async function setObjectiveBest(pct) {
    const row = {
      assessment_id: objectivePaper.id,
      user_id: learnerId,
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
    const { data: existing } = await admin
      .from("assessment_attempts")
      .select("id")
      .eq("assessment_id", objectivePaper.id)
      .eq("user_id", learnerId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error } = await admin
        .from("assessment_attempts")
        .update({ score: pct, percentage: pct, passed: pct >= 70 })
        .eq("id", existing.id);
      assert(!error, message({ error }));
      return;
    }
    const { error } = await admin.from("assessment_attempts").insert(row);
    assert(!error, message({ error }));
  }

  await test("a learner with no objective pass cannot open the paper", async () => {
    await setObjectiveBest(40);
    const { error } = await learner.rpc("create_theory_submission", {
      p_assessment_id: theoryPaper.id,
    });
    assert(error, "the paper opened without passing the objective assessment");
    assert(/objective/i.test(error.message), `unexpected reason: ${error.message}`);
  });

  await test("a learner who is not enrolled is told to enrol, not that they failed", async () => {
    const { data, error } = await other.rpc("theory_eligibility", { p_course_id: course.id });
    assert(!error, message({ error }));
    assert(data.state === "not_enrolled", `state is ${data.state}`);
  });

  // ---------------------------------------------------------------------------
  console.log("\nOpening the paper");
  // ---------------------------------------------------------------------------
  let submissionId = null;

  await test("passing the objective paper opens the paper", async () => {
    await setObjectiveBest(70);
    const { data, error } = await learner.rpc("create_theory_submission", {
      p_assessment_id: theoryPaper.id,
    });
    assert(!error, message({ error }));
    assert(typeof data === "string", "the paper did not return a submission id");
    submissionId = data;
    cleanup.push(() => admin.from("theory_submissions").delete().eq("id", submissionId));
  });

  await test("starting again resumes the same paper rather than opening a second", async () => {
    const { data, error } = await learner.rpc("create_theory_submission", {
      p_assessment_id: theoryPaper.id,
    });
    assert(!error, message({ error }));
    assert(data === submissionId, "a second paper was opened");
  });

  // ---------------------------------------------------------------------------
  console.log("\nChoosing five of the seven");
  // ---------------------------------------------------------------------------
  const chosen = questions.slice(0, 5).map((q) => q.id);

  await test("four questions are refused", async () => {
    const { error } = await learner.rpc("select_theory_questions", {
      p_submission_id: submissionId,
      p_question_ids: chosen.slice(0, 4),
    });
    assert(error, "a paper of four questions was accepted");
    assert(/exactly 5/i.test(error.message), `unexpected reason: ${error.message}`);
  });

  await test("six questions are refused", async () => {
    const { error } = await learner.rpc("select_theory_questions", {
      p_submission_id: submissionId,
      p_question_ids: questions.slice(0, 6).map((q) => q.id),
    });
    assert(error, "a paper of six questions was accepted");
  });

  await test("five questions are accepted", async () => {
    asArray(await learner.rpc("select_theory_questions", {
      p_submission_id: submissionId,
      p_question_ids: chosen,
    }));
  });

  await test("a question that is not on this paper is refused", async () => {
    const { data: stranger } = await admin
      .from("questions")
      .select("id")
      .neq("assessment_id", theoryPaper.id)
      .limit(1)
      .maybeSingle();
    if (!stranger) return; // nothing else seeded to point at
    const { error } = await learner.rpc("select_theory_questions", {
      p_submission_id: submissionId,
      p_question_ids: [...chosen.slice(0, 4), stranger.id],
    });
    assert(error, "a question from another paper was accepted");
  });

  await test("another learner's paper cannot be selected", async () => {
    const { error } = await other.rpc("select_theory_questions", {
      p_submission_id: submissionId,
      p_question_ids: chosen,
    });
    assert(error, "another learner wrote to this paper");
  });

  // ---------------------------------------------------------------------------
  console.log("\nWriting the answers");
  // ---------------------------------------------------------------------------
  let answerIds = [];

  await test("the workspace brings back the five questions and the saved answers", async () => {
    const { data, error } = await learner.rpc("get_theory_workspace", {
      p_submission_id: submissionId,
    });
    assert(!error, message({ error }));
    assert(data.questions.length === 7, `the workspace listed ${data.questions.length} questions`);
    assert(data.status === "draft", `status is ${data.status}`);
    assert(
      data.questions.filter((q) => q.selected).length === 5,
      "the workspace does not show five questions selected",
    );
    answerIds = data.questions.filter((q) => q.selected).map((q) => q.answer_id);
  });

  await test("the workspace never contains a model answer", async () => {
    const { data, error } = await learner.rpc("get_theory_workspace", {
      p_submission_id: submissionId,
    });
    assert(!error, message({ error }));
    assert(!JSON.stringify(data).includes("model_answer"), "the workspace leaked a model answer");
  });

  await test("a learner cannot read the questions table to find the model answers", async () => {
    const { data, error } = await learner.from("questions").select("id, model_answer_md").limit(1);
    assert(!error, message({ error }));
    assert(!data || data.length === 0, "a learner read the questions table");
  });

  await test("an unselected question cannot be written to", async () => {
    const { data } = await learner.rpc("get_theory_workspace", {
      p_submission_id: submissionId,
    });
    const stray = data.questions.find((q) => !q.selected);
    const { error } = await learner.rpc("save_theory_answer", {
      p_answer_id: stray.answer_id,
      p_text: ANSWER(99),
    });
    assert(error, "an unselected question accepted an answer");
  });

  await test("an answer autosaves with a word count", async () => {
    const text = ANSWER(1);
    const { data, error } = await learner.rpc("save_theory_answer", {
      p_answer_id: answerIds[0],
      p_text: text,
    });
    assert(!error, message({ error }));
    assert(data.saved === true, "the answer was not saved");
    assert(
      Number(data.word_count) === text.trim().split(/\s+/).length,
      `word count is ${data.word_count}`,
    );
  });

  await test("an empty answer does not count as written", async () => {
    const { error } = await learner.rpc("submit_theory_submission", {
      p_submission_id: submissionId,
    });
    assert(error, "a paper with four answers was handed in");
    assert(/empty|answer/i.test(error.message), `unexpected reason: ${error.message}`);
  });

  await test("a learner cannot move their own deadline or invent their own score", async () => {
    // No error is expected. RLS filters the rows out and says nothing, which is exactly
    // why this hole is easy to miss without a test.
    const { error, data } = await learner
      .from("theory_submissions")
      .update({ expires_at: new Date(Date.now() + 864e5).toISOString(), total_score: 100 })
      .eq("id", submissionId)
      .select("id");
    assert(!error, message({ error }));
    assert(!data || data.length === 0, "a learner updated their own submission row");
  });

  await test("a learner cannot hand in their own marks", async () => {
    const { error } = await learner.from("theory_grades").insert({
      theory_answer_id: answerIds[0],
      score: 20,
      feedback: "full marks, obviously",
    });
    assert(error, "a learner wrote a grade row");
  });

  await test("a learner cannot open the marking queue or any paper for marking", async () => {
    const queue = await learner.rpc("theory_grading_queue", { p_course_id: course.id });
    assert(queue.error, "a learner read the marking queue");
    const view = await learner.rpc("get_theory_grading_view", { p_submission_id: submissionId });
    assert(view.error, "a learner opened the grading view");
    const mark = await learner.rpc("grade_theory_answer", {
      p_theory_answer_id: answerIds[0],
      p_score: 20,
    });
    assert(mark.error, "a learner graded an answer");
    const release = await learner.rpc("release_theory_grade", { p_submission_id: submissionId });
    assert(release.error, "a learner released a paper");
  });

  // ---------------------------------------------------------------------------
  console.log("\nHanding it in");
  // ---------------------------------------------------------------------------
  await test("all five written, the paper hands in", async () => {
    for (const [n, answerId] of answerIds.slice(1).entries()) {
      asArray(await learner.rpc("save_theory_answer", {
        p_answer_id: answerId,
        p_text: ANSWER(n + 2),
      }));
    }
    const submit = await learner.rpc("submit_theory_submission", {
      p_submission_id: submissionId,
    });
    assert(!submit.error, message(submit));

    const { data, error } = await admin
      .from("theory_submissions")
      .select("status, total_words, submitted_at")
      .eq("id", submissionId)
      .single();
    assert(!error, message({ error }));
    assert(data.status === "submitted", `status is ${data.status}`);
    assert(Number(data.total_words) > 0, "no words were counted on the paper");
    assert(data.submitted_at, "the paper has no submission time");
  });

  await test("a handed-in paper cannot be edited any more", async () => {
    const { error } = await learner.rpc("save_theory_answer", {
      p_answer_id: answerIds[0],
      p_text: "one more thought, added late",
    });
    assert(error, "a submitted paper accepted another edit");
  });

  await test("handing in twice changes nothing", async () => {
    const { data: before } = await admin
      .from("theory_submissions")
      .select("status, submitted_at")
      .eq("id", submissionId)
      .single();
    const submit = await learner.rpc("submit_theory_submission", {
      p_submission_id: submissionId,
    });
    assert(!submit.error, message(submit));
    const { data: after } = await admin
      .from("theory_submissions")
      .select("status, submitted_at")
      .eq("id", submissionId)
      .single();
    assert(after.status === before.status, `status moved from ${before.status} to ${after.status}`);
    assert(
      String(after.submitted_at) === String(before.submitted_at),
      "the submission time moved on a second hand-in",
    );
  });

  await test("the result cannot be read before it is released", async () => {
    const { error } = await learner.rpc("get_theory_result", { p_submission_id: submissionId });
    assert(error, "an unreleased result was readable");
  });

  await test("another learner cannot read this result either", async () => {
    const { error } = await other.rpc("get_theory_result", { p_submission_id: submissionId });
    assert(error, "another learner read the result");
  });

  // ---------------------------------------------------------------------------
  console.log("\nA marker picks it up");
  // ---------------------------------------------------------------------------
  const markerId = await createUser(markerEmail);
  const { data: adminRole } = await admin
    .from("roles")
    .select("id")
    .eq("code", "admin")
    .single();
  await admin.from("user_roles").insert({ user_id: markerId, role_id: adminRole.id });
  await admin.from("course_staff").insert({
    course_id: course.id,
    user_id: markerId,
    staff_role: "instructor",
  });
  const marker = await clientFor(markerEmail);

  await test("the queue shows the paper and hides unfinished drafts", async () => {
    const { data, error } = await marker.rpc("theory_grading_queue", { p_course_id: course.id });
    assert(!error, message({ error }));
    const paper = data.submissions.find((s) => s.id === submissionId);
    assert(paper, "the handed-in paper is not in the queue");
    assert(paper.learner_email, "the queue does not say whose paper it is");
    assert(Number(paper.graded_count) === 0, "an unmarked paper reports marks already given");
    assert(
      !data.submissions.some((s) => s.status === "draft"),
      "a learner's unfinished draft appeared in the marking queue",
    );
  });

  await test("claiming the paper moves it into review", async () => {
    asArray(await marker.rpc("claim_theory_submission", { p_submission_id: submissionId }));
    const { data, error } = await admin
      .from("theory_submissions")
      .select("status")
      .eq("id", submissionId)
      .single();
    assert(!error, message({ error }));
    assert(data.status === "under_review", `status is ${data.status}`);
  });

  await test("the grading view carries the model answers the marker needs", async () => {
    const { data, error } = await marker.rpc("get_theory_grading_view", {
      p_submission_id: submissionId,
    });
    assert(!error, message({ error }));
    assert(data.answers.length === 5, `the grading view lists ${data.answers.length} answers`);
    assert(data.answers.every((a) => a.model_answer_md), "a model answer is missing for a marker");
    assert(/indicative/i.test(data.model_answer_caveat), "the examiner caveat is missing");
  });

  await test("a question the learner never chose cannot be marked", async () => {
    const { data } = await marker.rpc("get_theory_grading_view", {
      p_submission_id: submissionId,
    });
    const { data: stray } = await admin
      .from("theory_answers")
      .select("id")
      .eq("submission_id", submissionId)
      .eq("status", "not_selected")
      .limit(1)
      .maybeSingle();
    assert(stray, "no unselected answer row to test with");
    const { error } = await marker.rpc("grade_theory_answer", {
      p_theory_answer_id: stray.id,
      p_score: 20,
    });
    assert(error, "a question outside the paper was marked");
    void data;
  });

  // ---------------------------------------------------------------------------
  console.log("\nMarking");
  // ---------------------------------------------------------------------------
  const scores = [18, 17, 20, 19, 20];
  const expected = scores.reduce((a, b) => a + b, 0);

  await test("the marks add up and the paper only reads as graded at the end", async () => {
    const { data: view } = await marker.rpc("get_theory_grading_view", {
      p_submission_id: submissionId,
    });
    for (const [n, answer] of view.answers.entries()) {
      const mark = await marker.rpc("grade_theory_answer", {
        p_theory_answer_id: answer.answer_id,
        p_score: scores[n],
        p_feedback: `Marked against the model answer: ${answer.position <= 5 ? "sound" : "thin"}.`,
        p_rubric_ref: `Q${answer.position} p.${10 + n}`,
      });
      assert(!mark.error, `answer ${n + 1}: ${message(mark)}`);

      const { data } = await admin
        .from("theory_submissions")
        .select("status, total_score")
        .eq("id", submissionId)
        .single();
      if (n < scores.length - 1) {
        assert(data.status === "under_review", `paper read as ${data.status} before the end`);
        assert(data.total_score === null, "a running total was published early");
      }
    }
    const { data: done } = await admin
      .from("theory_submissions")
      .select("status, total_score")
      .eq("id", submissionId)
      .single();
    assert(done.status === "graded", `status is ${done.status} once every answer is marked`);
    assert(Number(done.total_score) === expected, `total is ${done.total_score}, expected ${expected}`);
  });

  await test("a re-grade changes the total and is recorded in the audit log", async () => {
    const { data: view } = await marker.rpc("get_theory_grading_view", {
      p_submission_id: submissionId,
    });
    const first = view.answers[0];
    const mark = await marker.rpc("grade_theory_answer", {
      p_theory_answer_id: first.answer_id,
      p_score: 12,
      p_feedback: "Re-read on a second pass: the classification argument is thinner than it looks.",
    });
    assert(!mark.error, message(mark));

    const { data: after } = await admin
      .from("theory_submissions")
      .select("total_score")
      .eq("id", submissionId)
      .single();
    assert(
      Number(after.total_score) === expected - 6,
      `total is ${after.total_score} after a re-grade from 18 to 12`,
    );

    const { data: logs } = await admin
      .from("audit_logs")
      .select("action, after")
      .eq("entity_id", first.answer_id)
      .eq("action", "theory.answer_graded")
      .order("created_at", { ascending: false });
    assert(logs?.length, "no audit entry for the re-grade");
    const latest = logs[0];
    assert(latest.after?.regrade === true, "the audit entry does not record it as a re-grade");
    assert(
      Number(latest.after?.before?.score) === 18,
      `the audit entry has no before score (${JSON.stringify(latest.after?.before)})`,
    );
    assert(
      Number(latest.after?.after?.score) === 12,
      `the audit entry has no after score (${JSON.stringify(latest.after?.after)})`,
    );
  });

  await test("overall feedback is saved for the learner", async () => {
    const feedback = "A careful paper. Classification is sound; the abstract is too literal.";
    const save = await marker.rpc("set_theory_overall_feedback", {
      p_submission_id: submissionId,
      p_feedback: feedback,
    });
    assert(!save.error, message(save));
    const { data } = await admin
      .from("theory_submissions")
      .select("overall_feedback")
      .eq("id", submissionId)
      .single();
    assert(data.overall_feedback === feedback, "the feedback was not stored");
  });

  // ---------------------------------------------------------------------------
  console.log("\nReleasing");
  // ---------------------------------------------------------------------------
  await test("releasing tells the learner, and the result opens", async () => {
    const release = await marker.rpc("release_theory_grade", { p_submission_id: submissionId });
    assert(!release.error, message(release));

    const { data, error } = await learner.rpc("get_theory_result", {
      p_submission_id: submissionId,
    });
    assert(!error, message({ error }));
    assert(data.answers.length === 5, `the result lists ${data.answers.length} answers`);
    assert(
      Number(data.total_score) === expected - 6,
      `the released mark is ${data.total_score}, expected ${expected - 6}`,
    );
    assert(data.passed === true, `a mark of ${data.total_score} did not pass`);
    assert(data.overall_feedback, "the released result has no overall feedback");
    assert(data.answers.every((a) => a.feedback), "an answer came back without feedback");
    assert(!JSON.stringify(data).includes("model_answer"), "the released result leaked a model answer");

    const { data: note } = await admin
      .from("notifications")
      .select("id, link")
      .eq("user_id", learnerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    assert(note, "the learner was not notified");
    assert(
      String(note.link).includes(submissionId),
      `the notification points at ${note.link}, not the paper`,
    );
  });

  await test("a released paper cannot be re-marked or released again", async () => {
    const { data: view } = await marker.rpc("get_theory_grading_view", {
      p_submission_id: submissionId,
    });
    const mark = await marker.rpc("grade_theory_answer", {
      p_theory_answer_id: view.answers[0].answer_id,
      p_score: 20,
    });
    assert(mark.error, "a released paper accepted a re-grade");
    const release = await marker.rpc("release_theory_grade", { p_submission_id: submissionId });
    assert(release.error, "a released paper was released a second time");
  });

  // ---------------------------------------------------------------------------
  console.log("\nTiming out");
  // ---------------------------------------------------------------------------
  // The first paper is released, so there is no draft left and this call opens a new one.
  let timedId = null;
  try {
    const { data, error } = await learner.rpc("create_theory_submission", {
      p_assessment_id: theoryPaper.id,
    });
    assert(!error, message({ error }));
    assert(data !== submissionId, "the released paper was handed back as a draft");
    timedId = data;
    cleanup.push(() => admin.from("theory_submissions").delete().eq("id", timedId));

    asArray(await learner.rpc("select_theory_questions", {
      p_submission_id: timedId,
      p_question_ids: chosen,
    }));
    const backdate = await admin
      .from("theory_submissions")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", timedId);
    assert(!backdate.error, message(backdate));
  } catch (e) {
    await test("a second paper opens for the timeout test", async () => {
      throw e;
    });
  }

  if (timedId) {
    await test("an out-of-time paper is closed with what was written, not left as a draft", async () => {
      const { data: fresh } = await admin
        .from("theory_answers")
        .select("id")
        .eq("submission_id", timedId)
        .eq("status", "draft")
        .limit(1)
        .maybeSingle();
      assert(fresh, "the timed paper has no answer rows to write to");
      const save = await learner.rpc("save_theory_answer", {
        p_answer_id: fresh.id,
        p_text: ANSWER(42),
      });
      assert(!save.error, `save_theory_answer raised instead of reporting: ${message(save)}`);
      assert(save.data.expired === true, "the runner was not told the paper was over");
      assert(save.data.saved === false, "an answer was stored after the deadline");

      const { data, error } = await admin
        .from("theory_submissions")
        .select("status, submitted_at")
        .eq("id", timedId)
        .single();
      assert(!error, message({ error }));
      assert(data.status === "submitted", `the paper is ${data.status}, not closed for marking`);
      assert(data.submitted_at, "the closed paper has no submission time");
    });

    await test("the closed paper is in the marking queue, ready to be read", async () => {
      const { data, error } = await marker.rpc("theory_grading_queue", { p_course_id: course.id });
      assert(!error, message({ error }));
      assert(
        data.submissions.some((s) => s.id === timedId),
        "the timed-out paper is not in the queue",
      );
    });
  }

  console.log("");
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }
  if (failed > 0) return false;
  return true;
}

main()
  .then((ok) => {
    if (!ok) process.exitCode = 1;
  })
  .catch((e) => {
    console.error("\nVerification could not run:", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Cleanup is best effort: some jobs are promises, some are Supabase builders that
    // only promise-like. Awaiting inside try/catch keeps a stray delete from failing a
    // run that actually passed.
    for (const job of cleanup.reverse()) {
      try {
        await job();
      } catch {
        /* leave it */
      }
    }
  });
