#!/usr/bin/env node
// LIS 815 LMS - page smoke tests (Phase 5 and Phase 8 gates).
// Fetches the real pages of a running production server as a signed-in learner:
//   node scripts/verify-pages.mjs        (server must already be running)
//   npm run test:pages
// Needs: npm run build && npm start   ·   .env.local keys   ·   npm run db:seed

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
const BASE = process.env.PAGE_TEST_BASE_URL || "http://localhost:3000";

if (!URL_ || !ANON || !SERVICE) {
  console.log("\nMissing Supabase credentials in .env.local.\n");
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
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

async function page(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const body = res.status === 307 || res.status === 404 ? "" : await res.text();
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    body,
    text: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  };
}

function sessionCookie(session) {
  const ref = new URL(URL_).host.split(".")[0];
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  return `sb-${ref}-auth-token=${value}`;
}

/** Binary downloads need their status line and headers, not an HTML dump. */
async function download(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    disposition: res.headers.get("content-disposition") || "",
    bytes: buf.length,
    magic: buf.subarray(0, 5).toString("latin1"),
  };
}

async function firstPhrases(lessonIds) {
  const { data } = await admin
    .from("lesson_sections")
    .select("lesson_id, content_md")
    .in("lesson_id", lessonIds);
  const out = new Map();
  for (const row of data ?? []) {
    const words = String(row.content_md ?? "")
      .replace(/[#*_>`~[\]()|-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 6)
      .join(" ");
    if (words) out.set(row.lesson_id, words.toLowerCase());
  }
  return out;
}

async function main() {
  console.log("LIS 815 LMS — page smoke tests");
  console.log(`  server: ${BASE}`);

  try {
    const probe = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(4000) });
    if (!probe.ok) throw new Error(`server answered ${probe.status}`);
  } catch (e) {
    console.log("");
    console.log(`The production server is not reachable (${e.message}).`);
    console.log("Run it first:  npm run build  &&  npm start");
    process.exit(1);
  }

  const { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("code", "LIS LMS")
    .maybeSingle();
  if (!course) {
    console.log("\nNo LIS 815 course yet — run:  npm run db:seed\n");
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
    .select("id, position, kind, status")
    .in("chapter_id", (chapters ?? []).map((c) => c.id))
    .eq("status", "published")
    .order("position");
  const readings = (lessons ?? []).filter((l) => l.kind === "reading");
  const first = readings[0];
  const later = readings[2];
  assert(first && later, "not enough reading lessons seeded");

  const stamp = Date.now();
  const PW = "PageTest!2026";
  const email = `pages-${stamp}@example.com`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser: ${createErr.message}`);
  const userId = created.user.id;

  const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
    email,
    password: PW,
  });
  if (signErr) throw new Error(`signIn: ${signErr.message}`);
  const cookie = sessionCookie(signed.session);

  await anon.rpc("enroll_self", { p_course_id: course.id });
  await anon.rpc("record_reading_event", {
    p_lesson_id: first.id,
    p_pct: 100,
    p_seconds: 300,
    p_section_id: null,
  });
  await anon.rpc("mark_lesson_complete", { p_lesson_id: first.id });

  const phrases = await firstPhrases([first.id, later.id]);
  const lockedPhrase = phrases.get(later.id);
  assert(lockedPhrase, "could not read the locked lesson's text");

  console.log("\nSigned out");
  await test("protected pages are browsable without an account", async () => {
    for (const path of [
      "/dashboard",
      "/dashboard/course",
      `/dashboard/lessons/${first.id}`,
      "/verify/NOT-A-REAL-CERTIFICATE",
    ]) {
      const res = await page(path);
      assert(res.status === 200, `${path} answered ${res.status}`);
    }
  });

  await test("public pages still answer 200", async () => {
    for (const path of ["/", "/help", "/login"]) {
      const res = await page(path);
      assert(res.status === 200, `${path} answered ${res.status}`);
    }
  });

  await test("a signed-in visitor is told when a certificate number is not real", async () => {
    const res = await page("/verify/NOT-A-REAL-CERTIFICATE", cookie);
    assert(res.status === 200, `verify page answered ${res.status}`);
    assert(/certificate not found/i.test(res.text), "no not-found answer");
    assert(
      !/certificate verified|certificate revoked/i.test(res.text),
      "the page claimed to verify a certificate that does not exist",
    );
    assert(
      !/status:\s*(valid|revoked)/i.test(res.text),
      "a certificate status was shown for a number that does not exist",
    );
  });

  const CERT_NUMBER = process.env.PAGE_TEST_CERT_NUMBER;
  if (CERT_NUMBER) {
    await test(`the real certificate ${CERT_NUMBER} verifies on this site`, async () => {
      const res = await page(`/verify/${encodeURIComponent(CERT_NUMBER)}`, cookie);
      assert(res.status === 200, `verify page answered ${res.status}`);
      assert(
        /certificate verified|certificate revoked/i.test(res.text),
        `neither verified nor revoked: ${res.text.slice(0, 200)}`,
      );
    });
  }

  console.log("\nSigned in as an enrolled learner");
  await test("the dashboard renders the learner's progress", async () => {
    const res = await page("/dashboard", cookie);
    assert(res.status === 200, `dashboard answered ${res.status}`);
    assert(/good (morning|afternoon|evening)/i.test(res.text), "no learner heading");
    assert(/continue learning|start the course/i.test(res.text), "no continue button");
    assert(/roadmap/i.test(res.text), "no roadmap");
  });

  await test("the course page lists the outline with lesson states", async () => {
    const res = await page("/dashboard/course", cookie);
    assert(res.status === 200, `course page answered ${res.status}`);
    assert(/module 1/i.test(res.text), "no module headings");
    assert(/chapter 1/i.test(res.text), "no chapter headings");
    assert(/completed/i.test(res.text), "no lesson status shown");
    assert(res.body.includes(`/dashboard/lessons/${first.id}`), "lessons are not linked");
  });

  await test("the reader renders a completed lesson's content", async () => {
    const res = await page(`/dashboard/lessons/${first.id}`, cookie);
    assert(res.status === 200, `reader answered ${res.status}`);
    assert(res.body.includes("lesson-content"), "article is missing");
    assert(/lesson completed/i.test(res.text), "completion state not shown");
    assert(res.body.includes("/dashboard/lessons/"), "no prev/next links");
  });

  await test("a locked lesson shows no content", async () => {
    const res = await page(`/dashboard/lessons/${later.id}`, cookie);
    assert(res.status === 200, `locked page answered ${res.status}`);
    assert(/still locked/i.test(res.text), "no locked explanation");
    assert(
      !res.text.toLowerCase().includes(lockedPhrase),
      "the locked lesson's text was served to the browser",
    );
    assert(!res.body.includes("lesson-content"), "the reader layout was rendered for a locked lesson");
  });

  await test("an unknown lesson shows the not-found page, not a lesson", async () => {
    const res = await page("/dashboard/lessons/00000000-0000-0000-0000-000000000000", cookie);
    // The loading shell streams first, so the status line cannot be changed to 404
    // afterwards - what matters is that the not-found UI is what the learner sees.
    assert(/page not found/i.test(res.text), `answered ${res.status} without a not-found page`);
    assert(!res.body.includes("lesson-content"), "the reader layout was rendered for an unknown id");
  });

  console.log("\nStudy tools");

  const { data: fileResource } = await admin
    .from("resources")
    .select("id, title")
    .eq("kind", "file")
    .limit(1)
    .maybeSingle();
  const { data: examPapers } = await admin
    .from("resources")
    .select("id, title")
    .eq("kind", "exam_paper");
  const { data: announcements } = await admin
    .from("announcements")
    .select("title")
    .eq("status", "published")
    .lte("publish_at", new Date().toISOString())
    .order("publish_at")
    .limit(1);
  assert(fileResource, "no student file resource is seeded");
  assert((examPapers ?? []).length >= 1, "no examination paper is seeded");
  assert((announcements ?? []).length >= 1, "no published announcement is seeded");

  await test("the dashboard links into the study tools", async () => {
    const res = await page("/dashboard", cookie);
    assert(res.status === 200, `dashboard answered ${res.status}`);
    for (const href of [
      "/dashboard/announcements",
      "/dashboard/search",
      "/dashboard/glossary",
      "/dashboard/revision",
      "/dashboard/notes",
    ]) {
      assert(res.body.includes(href), `the dashboard does not link to ${href}`);
    }
  });

  await test("the glossary lists the terms", async () => {
    const res = await page("/dashboard/glossary", cookie);
    assert(res.status === 200, `glossary answered ${res.status}`);
    assert(/words you are expected to know/i.test(res.text), "no glossary heading");
    assert(/PRECIS/i.test(res.text), "the PRECIS entry is missing");
    assert(/definition/i.test(res.text), "definitions are not shown");
  });

  await test("course search answers an empty query and a real one", async () => {
    const idle = await page("/dashboard/search", cookie);
    assert(idle.status === 200, `search answered ${idle.status}`);
    assert(/type at least two letters/i.test(idle.text), "no empty-query prompt");

    const hit = await page("/dashboard/search?q=PRECIS", cookie);
    assert(hit.status === 200, `search answered ${hit.status}`);
    assert(/PRECIS/i.test(hit.text), "the query is not echoed back");
    assert(/1 result/i.test(hit.text), "expected one result for PRECIS");
    assert(/glossary/i.test(hit.text), "the glossary result type is not labelled");
  });

  await test("the announcements page lists the published notice", async () => {
    const res = await page("/dashboard/announcements", cookie);
    assert(res.status === 200, `announcements answered ${res.status}`);
    assert(/announcements and notifications/i.test(res.text), "no announcements heading");
    assert(
      res.text.includes(announcements[0].title.slice(0, 40)),
      "the published announcement is not listed",
    );
  });

  await test("the resources page offers the study guide and no examination paper", async () => {
    const res = await page("/dashboard/resources", cookie);
    assert(res.status === 200, `resources answered ${res.status}`);
    assert(res.text.includes(fileResource.title.slice(0, 40)), "the study guide is not listed");
    assert(res.body.includes(`/api/resources/${fileResource.id}`), "no download link");
    for (const paper of examPapers) {
      assert(
        !res.text.includes(paper.title.slice(0, 40)),
        `a student sees the examination paper: ${paper.title}`,
      );
    }
  });

  await test("the revision centre offers Appendix B questions and the checklist", async () => {
    const res = await page("/dashboard/revision", cookie);
    assert(res.status === 200, `revision answered ${res.status}`);
    assert(/test yourself before the examination/i.test(res.text), "no revision heading");
    assert(/Appendix B/i.test(res.text), "no Appendix B badge");
    assert(/essay/i.test(res.text) && /short[- ]answer/i.test(res.text), "no question groups");
    assert(/checklist/i.test(res.text), "no final checklist");
  });

  await test("the notes and bookmarks pages open", async () => {
    const notesPage = await page("/dashboard/notes", cookie);
    assert(notesPage.status === 200, `notes answered ${notesPage.status}`);
    assert(/everything you wrote while reading/i.test(notesPage.text), "no notes heading");

    const marksPage = await page("/dashboard/bookmarks", cookie);
    assert(marksPage.status === 200, `bookmarks answered ${marksPage.status}`);
    assert(/saved for later/i.test(marksPage.text), "no bookmarks heading");
  });

  console.log("\nDownloads");
  await test("a signed-out visitor is refused the file", async () => {
    const res = await download(`/api/resources/${fileResource.id}`);
    assert(res.status === 401, `answered ${res.status} without a session`);
  });

  await test("a student receives the study guide as an attachment", async () => {
    const res = await download(`/api/resources/${fileResource.id}`, cookie);
    assert(res.status === 200, `answered ${res.status}`);
    assert(res.disposition.includes("attachment"), `content-disposition: ${res.disposition}`);
    assert(res.magic === "%PDF-", `not a PDF: ${res.magic}`);
    assert(res.bytes > 100_000, `only ${res.bytes} bytes came back`);
  });

  await test("an examination paper is not served to a student", async () => {
    for (const paper of examPapers) {
      const res = await download(`/api/resources/${paper.id}`, cookie);
      assert(res.status === 404, `${paper.title} answered ${res.status}`);
      assert(res.magic !== "%PDF-", "the paper was handed over");
    }
  });

  console.log("");
  console.log(`  ${passed} passed, ${failed} failed`);

  await admin.auth.admin.deleteUser(userId).catch(() => {});

  if (failed > 0) {
    console.log("");
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nVerification could not run:", e.message);
  process.exit(1);
});
