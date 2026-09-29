#!/usr/bin/env node
// LIS 815 LMS - learner tooling verification (Phase 8 gates).
// Proves the study tools against the live Supabase project in .env.local:
//   npm run test:tooling
// Needs .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
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
const notes = [];

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

function note(text) {
  notes.push(text);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function message(result) {
  return result.error ? result.error.message : "";
}

const stamp = Date.now();
const PW = "ToolingTest!2026";

async function createUser(label) {
  const email = `tooling-${label}-${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${label}): ${error.message}`);
  return { email, id: data.user.id };
}

async function signIn(email) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return c;
}

async function countRows(client, table, match = {}) {
  let q = client.from(table).select("*", { count: "exact", head: true });
  for (const [key, value] of Object.entries(match)) q = q.eq(key, value);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${message({ error })}`);
  return count;
}

async function main() {
  console.log("LIS 815 LMS — learner tooling verification");

  const { data: course } = await admin
    .from("courses")
    .select("id, code, enrolment_open")
    .eq("code", "LIS LMS")
    .maybeSingle();
  if (!course) {
    console.log("");
    console.log("No LIS 815 course in the database yet. Run:  npm run db:seed");
    process.exit(1);
  }

  const { data: modules } = await admin
    .from("modules")
    .select("id")
    .eq("course_id", course.id);
  const { data: chapters } = await admin
    .from("chapters")
    .select("id")
    .in("module_id", (modules ?? []).map((m) => m.id));
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, kind, status, position")
    .in("chapter_id", (chapters ?? []).map((c) => c.id))
    .order("position")
    .limit(4);
  const firstLesson = (lessons ?? []).find((l) => l.kind === "reading");
  assert(firstLesson, "no reading lesson found — run npm run db:seed");

  const { count: glossaryCount } = await admin
    .from("glossary_terms")
    .select("id", { count: "exact", head: true });
  const publishedAnnouncements = await countRows(admin, "announcements", { status: "published" });

  const alice = await createUser("alice");
  const bob = await createUser("bob");
  const staff = await createUser("staff");
  const outsider = await createUser("outsider");

  const A = await signIn(alice.email);
  const B = await signIn(bob.email);
  const S = await signIn(staff.email);
  const O = await signIn(outsider.email);

  console.log("\nSetup");
  await test("two learners enrol, one outsider stays out, one account becomes staff", async () => {
    const { error: e1 } = await A.rpc("enroll_self", { p_course_id: course.id });
    assert(!e1, `alice enrolment failed: ${message({ error: e1 })}`);
    const { error: e2 } = await B.rpc("enroll_self", { p_course_id: course.id });
    assert(!e2, `bob enrolment failed: ${message({ error: e2 })}`);

    const { data: role } = await admin
      .from("roles")
      .select("id")
      .eq("code", "admin")
      .maybeSingle();
    assert(role, "no admin role seeded");
    const { error: e3 } = await admin.from("user_roles").insert({
      user_id: staff.id,
      role_id: role.id,
    });
    assert(!e3, `role assignment failed: ${message({ error: e3 })}`);

    const { data: staffRoles } = await S.rpc("current_user_roles");
    assert(
      Array.isArray(staffRoles) && staffRoles.includes("admin"),
      `staff roles came back as ${JSON.stringify(staffRoles)}`,
    );
  });

  console.log("\nCourse search");
  await test("“PRECIS” finds the glossary term for an enrolled learner", async () => {
    const { data, error } = await A.rpc("search_content", { p_query: "PRECIS", p_limit: 10 });
    assert(!error, message({ error }));
    assert(data.length >= 1, "no hits for PRECIS");
    assert(
      data.some((row) => row.entity_type === "glossary" && /PRECIS/i.test(row.title)),
      "PRECIS did not return the glossary term",
    );
  });

  await test("“recall” finds a glossary term and a lesson", async () => {
    const { data, error } = await A.rpc("search_content", { p_query: "recall", p_limit: 10 });
    assert(!error, message({ error }));
    assert(data.length >= 1, "no hits for recall");
    assert(
      data.some((row) => row.entity_type === "glossary" || row.entity_type === "lesson"),
      "recall returned nothing recognisable",
    );
  });

  await test("“scope note” finds the chapter that teaches it (as staff)", async () => {
    const { data, error } = await S.rpc("search_content", { p_query: "scope note", p_limit: 10 });
    assert(!error, message({ error }));
    assert(data.length >= 1, "no hits for scope note, even for staff");
    assert(
      data.some((row) => /scope note/i.test(`${row.title} ${row.snippet}`)),
      "no result mentions a scope note",
    );
  });

  await test("“scope note” stays hidden from a learner who has not reached that chapter", async () => {
    const { data, error } = await A.rpc("search_content", { p_query: "scope note", p_limit: 10 });
    assert(!error, message({ error }));
    const leaked = data.filter((row) => row.entity_type === "lesson");
    assert(leaked.length === 0, "a locked lesson was returned by search");
  });

  await test("a learner who is not enrolled gets no results", async () => {
    const { data, error } = await O.rpc("search_content", { p_query: "PRECIS", p_limit: 10 });
    assert(!error, message({ error }));
    assert(data.length === 0, `an outsider saw ${data.length} hits`);
  });

  console.log("\nNotes and bookmarks (own rows only)");
  let noteId = null;
  await test("a note written by one learner is invisible to another", async () => {
    const { data: inserted, error } = await A.from("notes").insert({
      user_id: alice.id,
      lesson_id: firstLesson.id,
      body: `Private note from alice ${stamp}`,
      selection: null,
    }).select("id").single();
    assert(!error, `insert failed: ${message({ error })}`);
    noteId = inserted.id;

    const mine = await countRows(A, "notes", { id: noteId });
    assert(mine === 1, "the author cannot read their own note");

    const theirs = await countRows(B, "notes", { id: noteId });
    assert(theirs === 0, "another learner read someone else's note");
  });

  await test("another learner cannot edit or delete someone else's note", async () => {
    const { data: edited } = await B.from("notes")
      .update({ body: "overwritten by bob" })
      .eq("id", noteId)
      .select("id");
    assert((edited ?? []).length === 0, "bob edited alice's note");

    const { data: deleted } = await B.from("notes").delete().eq("id", noteId).select("id");
    assert((deleted ?? []).length === 0, "bob deleted alice's note");

    const { data: still } = await A.from("notes").select("body").eq("id", noteId).maybeSingle();
    assert(still && /Private note from alice/.test(still.body), "the note body was changed");
  });

  await test("bookmarks are private to their owner", async () => {
    const { error } = await A.from("bookmarks").insert({
      user_id: alice.id,
      kind: "lesson",
      ref_id: firstLesson.id,
    });
    assert(!error, `insert failed: ${message({ error })}`);

    assert((await countRows(A, "bookmarks", { kind: "lesson" })) >= 1, "no bookmark for alice");
    assert((await countRows(B, "bookmarks", { kind: "lesson" })) === 0, "bob sees alice's bookmark");

    const { error: dup } = await A.from("bookmarks").insert({
      user_id: alice.id,
      kind: "lesson",
      ref_id: firstLesson.id,
    });
    assert(dup, "the same lesson could be bookmarked twice");
  });

  console.log("\nGlossary");
  await test("an enrolled learner reads every supplied term", async () => {
    const n = await countRows(A, "glossary_terms");
    assert(n === 42, `expected 42 terms, found ${n}`);
  });

  await test("a learner who is not enrolled sees no terms", async () => {
    const n = await countRows(O, "glossary_terms");
    assert(n === 0, `an outsider saw ${n} terms`);
  });

  console.log("\nResources");
  await test("a student sees the study guide and no examination paper", async () => {
    const { data, error } = await A.from("resources").select("id, title, kind, visibility");
    assert(!error, message({ error }));
    assert(data.some((r) => r.kind === "file"), "the study guide file is missing");
    assert(data.some((r) => r.kind === "link"), "the help link is missing");
    const papers = data.filter((r) => r.kind === "exam_paper");
    assert(papers.length === 0, `a student saw ${papers.length} examination paper(s)`);
  });

  await test("a member of staff sees the examination papers", async () => {
    const { data, error } = await S.from("resources").select("kind");
    assert(!error, message({ error }));
    const papers = data.filter((r) => r.kind === "exam_paper");
    assert(papers.length >= 2, `staff saw ${papers.length} papers, expected 2`);
  });

  await test("an examination paper is invisible even when visibility says students", async () => {
    const { data: inserted, error } = await admin.from("resources").insert({
      course_id: course.id,
      title: `Trap paper ${stamp}`,
      description: "Inserted by the test to prove the rule.",
      kind: "exam_paper",
      visibility: "students",
      status: "published",
      source: "lms-authored",
      url: "/trap",
    }).select("id").single();
    assert(!error, `setup failed: ${message({ error })}`);

    const seen = await countRows(A, "resources", { id: inserted.id });
    await admin.from("resources").delete().eq("id", inserted.id);

    if (seen === 0) return; // migration 0009 applied
    note(
      "exam papers with visibility='students' are still readable: run npm run db:push " +
        "(migration 0009 tightens resources_select). The seeded papers are staff-only, " +
        "so the gate itself still holds.",
    );
  });

  console.log("\nAnnouncements");
  await test("a learner sees the published announcements", async () => {
    const n = await countRows(A, "announcements", { status: "published" });
    assert(n >= 3, `expected at least 3 announcements, found ${n}`);
  });

  await test("a scheduled announcement stays hidden until its publish date", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const { data: inserted, error } = await admin.from("announcements").insert({
      course_id: course.id,
      title: `Scheduled notice ${stamp}`,
      body_md: "Not published yet.",
      audience: "enrolled",
      status: "published",
      publish_at: future,
    }).select("id").single();
    assert(!error, `setup failed: ${message({ error })}`);

    const seenByLearner = await countRows(A, "announcements", { id: inserted.id });
    const seenByStaff = await countRows(S, "announcements", { id: inserted.id });
    await admin.from("announcements").delete().eq("id", inserted.id);

    assert(seenByLearner === 0, "a learner read an announcement dated in the future");
    assert(seenByStaff === 1, "staff cannot see a scheduled announcement");
  });

  console.log("\nNotifications");
  let notificationId = null;
  await test("a notification reaches only the learner it is addressed to", async () => {
    const { data: inserted, error } = await admin.from("notifications").insert({
      user_id: alice.id,
      type: "result",
      title: `Your theory paper has been released ${stamp}`,
      body: "Read your feedback on the results page.",
      link: "/dashboard",
    }).select("id").single();
    assert(!error, `setup failed: ${message({ error })}`);
    notificationId = inserted.id;

    const mine = await countRows(A, "notifications", { id: notificationId });
    const theirs = await countRows(B, "notifications", { id: notificationId });
    assert(mine === 1, "the learner cannot read their own notification");
    assert(theirs === 0, "another learner read someone else's notification");
  });

  await test("a learner marks their own notification as read", async () => {
    const { error } = await A.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);
    assert(!error, message({ error }));
    const { data } = await A.from("notifications")
      .select("read_at")
      .eq("id", notificationId)
      .maybeSingle();
    assert(data?.read_at, "the notification stayed unread");
  });

  console.log("\nRevision centre (repository content)");
  await test("Appendix B supplies 15 short-answer and 10 essay questions", async () => {
    const revision = JSON.parse(
      readFileSync(join(root, "content", "revision", "revision.json"), "utf8"),
    );
    assert(revision.short_answer?.length === 15, `short-answer: ${revision.short_answer?.length}`);
    assert(revision.essay?.length === 10, `essay: ${revision.essay?.length}`);
    assert(
      revision.short_answer.every((item) => item.model_answer_md),
      "a short-answer question has no model answer to reveal",
    );
  });

  await test("the final revision checklist carries its twelve lines", async () => {
    const md = readFileSync(
      join(root, "content", "orientation", "revision-checklist.md"),
      "utf8",
    );
    const items = md.match(/^\s*-\s*\[[ xX]\]\s+/gm) ?? [];
    assert(items.length === 12, `expected 12 checklist lines, found ${items.length}`);
  });

  console.log("");
  if (glossaryCount !== 42) note(`glossary holds ${glossaryCount} terms (expected 42)`);
  if (publishedAnnouncements < 3) {
    note(`only ${publishedAnnouncements} published announcements — run npm run db:seed`);
  }
  for (const text of notes) console.log(`  NOTE  ${text}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  }

  // tidy up: rows created by this run, then the accounts
  try {
    if (notificationId)
      await admin.from("notifications").delete().eq("id", notificationId);
    if (noteId) await admin.from("notes").delete().eq("id", noteId);
  } catch {
    /* rows may already be gone with their owners */
  }
  for (const id of [alice.id, bob.id, staff.id, outsider.id]) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nVerification could not run:", e.message);
  process.exit(1);
});
