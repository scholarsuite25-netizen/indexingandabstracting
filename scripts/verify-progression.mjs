#!/usr/bin/env node
// LIS 815 LMS - progression engine verification (Phase 5 gates).
// Proves the server-side rules against the live Supabase project in .env.local:
//   npm run test:progress
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

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
const PW = "ProgressTest!2026";
const email = `progress-${stamp}@example.com`;

async function createUser() {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  return data.user.id;
}

function learnerClient() {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  return c.auth.signInWithPassword({ email, password: PW }).then(({ error }) => {
    if (error) throw new Error(`signIn: ${error.message}`);
    return c;
  });
}

async function state() {
  const { data: course } = await admin
    .from("courses")
    .select("id, code, status, enrolment_open")
    .eq("code", "LIS 815")
    .maybeSingle();
  if (!course) return { course: null };

  const { data: modules, error: moduleErr } = await admin
    .from("modules")
    .select("id, position")
    .eq("course_id", course.id)
    .order("position");
  if (moduleErr) throw new Error(`modules: ${moduleErr.message}`);
  const moduleIds = (modules ?? []).map((m) => m.id);

  // Scope everything to this course: other suites create their own courses, and their
  // lessons must never leak into LIS 815's reading order.
  const { data: chapters, error: chapterErr } = await admin
    .from("chapters")
    .select("id, module_id, position")
    .in("module_id", moduleIds);
  if (chapterErr) throw new Error(`chapters: ${chapterErr.message}`);
  const chapterIds = (chapters ?? []).map((c) => c.id);

  const { data: lessons, error: lessonErr } = await admin
    .from("lessons")
    .select("id, chapter_id, position, kind, required_reading_pct, status")
    .in("chapter_id", chapterIds)
    .order("position");
  if (lessonErr) throw new Error(`lessons: ${lessonErr.message}`);

  const modulePos = new Map((modules ?? []).map((m) => [m.id, Number(m.position)]));
  const chapterPos = new Map(
    (chapters ?? []).map((c) => [
      c.id,
      (modulePos.get(c.module_id) ?? 0) * 1000 + Number(c.position),
    ]),
  );

  const ordered = (lessons ?? [])
    .filter((l) => l.status === "published" && chapterPos.has(l.chapter_id))
    .map((l) => ({ ...l, key: chapterPos.get(l.chapter_id) * 1000 + Number(l.position) }))
    .sort((a, b) => a.key - b.key);

  const { count: sections, error: sectionErr } = await admin
    .from("lesson_sections")
    .select("id", { count: "exact", head: true })
    .in("lesson_id", ordered.map((l) => l.id));
  if (sectionErr) throw new Error(`lesson_sections: ${sectionErr.message}`);

  return { course, modules: modules ?? [], lessons: ordered, sections: sections ?? 0 };
}

/** Course order is alternating: a reading lesson, then its knowledge check. Only reading
 *  lessons carry sections, so content assertions must use those. */
function readingLessons(lessons) {
  return lessons.filter((l) => l.kind === "reading");
}

async function main() {
  console.log("LIS 815 LMS — progression verification");

  const s = await state();
  if (!s.course) {
    console.log("");
    console.log("No LIS 815 course in the database yet.");
    console.log("Apply the migrations in the Supabase SQL Editor, then run:  npm run db:seed");
    process.exit(1);
  }
  if (!s.course.enrolment_open) {
    console.log("");
    console.log("Course enrolment is closed — set courses.enrolment_open = true and re-run.");
    process.exit(1);
  }

  const lessons = s.lessons;
  const readings = readingLessons(lessons);
  const first = readings[0];
  const second = readings[1];
  const third = readings[2];
  const checkLesson = lessons.find((l) => l.kind === "check");

  console.log(
    `  course ${s.course.id} · ${s.modules.length} modules · ${lessons.length} lessons · ${s.sections} sections`,
  );
  if (!first || !second || !third || !checkLesson) {
    console.log("Not enough lessons seeded — run:  npm run db:seed");
    process.exit(1);
  }

  await createUser();
  const learner = await learnerClient();

  console.log("\nSetup");
  await test("self-enrolment opens the course for a new learner", async () => {
    const { error } = await learner.rpc("enroll_self", { p_course_id: s.course.id });
    assert(!error, message({ error }));
    const { data } = await admin
      .from("course_enrollments")
      .select("id, status")
      .eq("course_id", s.course.id)
      .eq("user_id", (await learner.auth.getUser()).data.user.id)
      .maybeSingle();
    assert(data, "no enrolment row was created");
  });

  await test("first lesson is readable; later lessons are not", async () => {
    const open = await learner.from("lesson_sections").select("id").eq("lesson_id", first.id);
    assert(!open.error, message(open));
    assert(open.data.length > 0, "first lesson served no sections");

    const hidden = await learner.from("lesson_sections").select("id").eq("lesson_id", second.id);
    assert(!hidden.error, message(hidden));
    assert(hidden.data.length === 0, "a locked lesson served its content");
  });

  await test("locked lesson completion is refused", async () => {
    const { error } = await learner.rpc("mark_lesson_complete", { p_lesson_id: second.id });
    assert(error, "completion of a locked lesson was allowed");
    assert(
      /prerequisite|accessible|enrolled/i.test(error.message),
      `unexpected reason: ${error.message}`,
    );
  });

  console.log("\nReading requirement");
  await test("marking complete before reading enough is refused with a plain reason", async () => {
    const { error } = await learner.rpc("mark_lesson_complete", { p_lesson_id: first.id });
    assert(error, "completion succeeded with no reading at all");
    assert(/read at least/i.test(error.message), `unexpected reason: ${error.message}`);
    assert(
      new RegExp(`read at least ${first.required_reading_pct}`, "i").test(error.message),
      `the refusal does not say how much is required: ${error.message}`,
    );
    assert(
      /currently \d+ percent/i.test(error.message),
      `the refusal does not say how far the learner got: ${error.message}`,
    );
  });

  await test("reading below the threshold is still refused", async () => {
    const tooLittle = Math.max(1, Number(first.required_reading_pct) - 20);
    const { error: rec } = await learner.rpc("record_reading_event", {
      p_lesson_id: first.id,
      p_pct: tooLittle,
      p_seconds: 60,
      p_section_id: null,
    });
    assert(!rec, message({ error: rec }));
    const { error } = await learner.rpc("mark_lesson_complete", { p_lesson_id: first.id });
    assert(error, `completion succeeded at ${tooLittle}% read`);
    assert(/read at least/i.test(error.message), `unexpected reason: ${error.message}`);
  });

  await test("reading to the threshold completes the lesson", async () => {
    const { error: rec } = await learner.rpc("record_reading_event", {
      p_lesson_id: first.id,
      p_pct: 100,
      p_seconds: 120,
      p_section_id: null,
    });
    assert(!rec, message({ error: rec }));
    const { error } = await learner.rpc("mark_lesson_complete", { p_lesson_id: first.id });
    assert(!error, `completion was refused at 100% read: ${message({ error })}`);
  });

  console.log("\nUnlocking and roll-up");
  await test("the knowledge check that follows the reading lesson unlocks immediately", async () => {
    const { data, error } = await learner.rpc("can_access_lesson", { p_lesson_id: checkLesson.id });
    assert(!error, message({ error }));
    assert(data === true, "the knowledge check did not unlock");
  });

  await test("a knowledge check cannot be completed without passing it", async () => {
    const { error } = await learner.rpc("mark_lesson_complete", { p_lesson_id: checkLesson.id });
    assert(error, "a knowledge check was completed without any attempt");
    assert(
      /knowledge check/i.test(error.message),
      `unexpected reason: ${error.message}`,
    );
  });

  await test("the next reading lesson stays locked until its check is passed", async () => {
    const { data } = await learner.rpc("can_access_lesson", { p_lesson_id: second.id });
    assert(data === false, "the next reading lesson opened early");
    const hidden = await learner.from("lesson_sections").select("id").eq("lesson_id", second.id);
    assert(hidden.data.length === 0, "a locked lesson served its content");
  });

  await test("course progress roll-up moves off zero", async () => {
    const { data } = await admin
      .from("course_enrollments")
      .select("progress_pct, required_lessons_done")
      .eq("course_id", s.course.id)
      .eq("user_id", (await learner.auth.getUser()).data.user.id)
      .maybeSingle();
    assert(data, "no enrolment row");
    assert(Number(data.required_lessons_done) >= 1, "completed lessons were not counted");
    assert(Number(data.progress_pct) > 0, "progress_pct stayed at 0");
  });

  await test("the lesson after that is still locked (chain intact)", async () => {
    const { data } = await learner.rpc("can_access_lesson", { p_lesson_id: third.id });
    assert(data === false, "lesson 3 opened early");
    const hidden = await learner.from("lesson_sections").select("id").eq("lesson_id", third.id);
    assert(hidden.data.length === 0, "a locked lesson served its content");
  });

  await test("progress survives a fresh sign-in", async () => {
    const fresh = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { error } = await fresh.auth.signInWithPassword({ email, password: PW });
    assert(!error, message({ error }));
    const { data } = await fresh
      .from("lesson_progress")
      .select("status, reading_pct")
      .eq("lesson_id", first.id)
      .maybeSingle();
    assert(data?.status === "completed", "completion was lost after signing in again");
    assert(Number(data?.reading_pct) >= Number(first.required_reading_pct), "reading % was lost");
  });

  await test("learners cannot write lesson_progress directly", async () => {
    const { error } = await learner.from("lesson_progress").insert({
      user_id: (await learner.auth.getUser()).data.user.id,
      lesson_id: third.id,
      status: "completed",
    });
    assert(error, "a learner inserted lesson_progress themselves");
  });

  console.log("");
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }

  await admin.auth.admin.deleteUser((await learner.auth.getUser()).data.user.id).catch(() => {});
}

main().catch((e) => {
  console.error("\nVerification could not run:", e.message);
  process.exit(1);
});
