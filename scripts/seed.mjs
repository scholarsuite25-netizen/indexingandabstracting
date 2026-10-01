#!/usr/bin/env node
// LIS 815 LMS content seeder — npm run db:seed
//
//   npm run db:seed                seed the Supabase project (keys in .env.local)
//   npm run db:seed -- --dry-run   parse content and print the row plan (no database)
//   npm run db:seed -- --pglite    prove the whole seed against a throwaway local Postgres
//                                  (runs the migrations, seeds twice, asserts counts)
//   npm run db:seed -- --force     update existing rows from repo content (overwrites admin edits)
//
// Idempotency: rows are found by natural keys and SKIPPED when they already exist,
// so re-seeding never duplicates — and never overwrites CMS edits unless --force.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY = args.includes("--dry-run");
const PGLITE = args.includes("--pglite");

// Explicit jsonb wrapper: the two drivers serialize JSON columns differently.
class Jsonb {
  constructor(value) {
    this.value = value;
  }
}
const J = (value) => new Jsonb(value);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------- content loading

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error("missing frontmatter");
  const data = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (/^-?\d+$/.test(value)) value = Number(value);
    data[kv[1]] = value;
  }
  return { data, body: match[2] };
}

function sectionKind(title) {
  const t = title.trim();
  if (/^learning objectives$/i.test(t)) return "objectives";
  if (/^review questions$/i.test(t)) return "exercise";
  if (/^\d+\.\d+\s/.test(t)) return "prose";
  if (/^(worked example|example entry|example|case )/i.test(t)) return "example";
  if (/^formula/i.test(t)) return "formula";
  if (/^(try it|exercise|practice)/i.test(t)) return "exercise";
  return "prose";
}

function splitSections(body) {
  const parts = body.split(/^##\s+/m).slice(1);
  return parts.map((part) => {
    const nl = part.indexOf("\n");
    const title = (nl === -1 ? part : part.slice(0, nl)).trim();
    const content = (nl === -1 ? "" : part.slice(nl + 1)).trim();
    return { title, content, kind: sectionKind(title) };
  });
}

const MODULES = {
  1: "Theoretical Foundations and Types of Indexes",
  2: "Vocabulary Control",
  3: "Pre-Coordinate Indexing Systems",
  4: "Post-Coordinate and Derived Indexing",
  5: "Performance Evaluation and System Metrics",
  6: "Abstracting Principles and Applications",
  7: "Digital, Automated and AI-Assisted Indexing",
};

const CHAPTER_MODULE = (ch) =>
  ({ 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 6, 13: 6, 14: 7 })[ch];

function loadContent() {
  const json = (rel) => JSON.parse(fs.readFileSync(path.join(CONTENT, rel), "utf8"));
  const course = json("course.json");

  const chapters = [];
  const coreDir = path.join(CONTENT, "core");
  for (const moduleDir of fs.readdirSync(coreDir).sort()) {
    const dir = path.join(coreDir, moduleDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
      const { data, body } = parseFrontmatter(raw);
      chapters.push({
        ...data,
        sections: splitSections(body),
        source_file: `core/${moduleDir}/${file}`,
      });
    }
  }
  chapters.sort((a, b) => a.chapter - b.chapter);

  const knowledge = chapters.map((ch) =>
    json(path.join("assessments", "knowledge", `chapter-${String(ch.chapter).padStart(2, "0")}.json`)),
  );

  return {
    course,
    chapters,
    knowledge,
    objective: json(path.join("assessments", "objective.json")),
    theory: json(path.join("assessments", "theory.json")),
    glossary: json(path.join("glossary", "glossary.json")),
    practicals: json(path.join("practicals", "practicals.json")),
    revision: json(path.join("revision", "revision.json")),
    resources: json(path.join("resources", "resources.json")),
    announcements: json(path.join("announcements", "announcements.json")),
    orientation: fs
      .readdirSync(path.join(CONTENT, "orientation"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => {
        const { data, body } = parseFrontmatter(
          fs.readFileSync(path.join(CONTENT, "orientation", f), "utf8").replace(/\r\n/g, "\n"),
        );
        return { ...data, body };
      }),
  };
}

// ---------------------------------------------------------------- clients

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}

async function pgliteClient(db) {
  const sqlValue = (v) => (v === null || v === undefined ? "null" : v);
  return {
    kind: "pglite",
    async find(table, match) {
      const keys = Object.keys(match);
      const where = keys.map((k, i) => `${k} = $${i + 1}`).join(" and ");
      const res = await db.query(
        `select * from public.${table} where ${where} limit 1`,
        keys.map((k) => match[k]),
      );
      const row = res.rows[0];
      return row ? (row.id ?? row.key ?? null) : null;
    },
    async exists(table, match) {
      const keys = Object.keys(match);
      const where = keys.map((k, i) => `${k} = $${i + 1}`).join(" and ");
      const res = await db.query(
        `select 1 as one from public.${table} where ${where} limit 1`,
        keys.map((k) => match[k]),
      );
      return res.rows.length > 0;
    },
    async insert(table, row, returnId = true) {
      const cols = Object.keys(row);
      const values = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return "null";
        if (v instanceof Jsonb) return `'${JSON.stringify(v.value).replace(/'/g, "''")}'`;
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
        return String(v);
      });
      const res = await db.query(
        `insert into public.${table} (${cols.join(", ")}) values (${values.join(", ")})${
          returnId ? " returning id" : ""
        }`,
      );
      return returnId ? res.rows[0].id : null;
    },
    async update(table, match, patch) {
      const matchKeys = Object.keys(match);
      const where = matchKeys.map((k, i) => `${k} = $${i + 1}`).join(" and ");
      const params = matchKeys.map((k) => match[k]);
      const sets = Object.keys(patch)
        .map((c) => {
          const v = patch[c];
          if (v === null || v === undefined) return `${c} = null`;
          if (v instanceof Jsonb) return `${c} = '${JSON.stringify(v.value).replace(/'/g, "''")}'::jsonb`;
          if (typeof v === "object") return `${c} = '${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
          params.push(v);
          return `${c} = $${params.length}`;
        })
        .join(", ");
      await db.query(`update public.${table} set ${sets} where ${where}`, params);
    },
    async count(table) {
      const res = await db.query(`select count(*)::int as n from public.${table}`);
      return res.rows[0].n;
    },
    async scalar(sql) {
      const res = await db.query(sql);
      return Object.values(res.rows[0])[0];
    },
    sqlValue,
  };
}

const unwrap = (obj) =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v instanceof Jsonb ? v.value : v]),
  );

async function supabaseClient() {
  loadEnv();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("");
    console.error("db:seed needs your Supabase keys before it can write to a project.");
    console.error("Add these two lines to .env.local (Phase 2 instructions):");
    console.error("  NEXT_PUBLIC_SUPABASE_URL=<your project URL>");
    console.error("  SUPABASE_SERVICE_ROLE_KEY=<your secret service_role key>");
    console.error("");
    console.error("Meanwhile you can prove the seed locally:  npm run db:seed -- --pglite");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const guard = (res) => {
    if (res.error) throw new Error(`${res.error.message} (${res.error.code || ""})`);
    return res.data;
  };
  return {
    kind: "supabase",
    async find(table, match) {
      const data = guard(await c.from(table).select("*").match(match).limit(1));
      const row = data[0];
      return row ? (row.id ?? row.key ?? null) : null;
    },
    async exists(table, match) {
      const data = guard(await c.from(table).select("*").match(match).limit(1));
      return data.length > 0;
    },
    async insert(table, row, returnId = true) {
      let query = c.from(table).insert(unwrap(row));
      if (returnId) query = query.select("id");
      const data = guard(await query);
      const inserted = Array.isArray(data) ? data[0] : data;
      return returnId ? (inserted?.id ?? null) : null;
    },
    async update(table, match, patch) {
      guard(await c.from(table).update(unwrap(patch)).match(match));
    },
    async count(table) {
      const res = await c.from(table).select("*", { count: "exact", head: true });
      if (res.error) throw new Error(`count ${table}: ${res.error.message}`);
      return res.count ?? 0;
    },
    async scalar() {
      throw new Error("scalar() is only used in --pglite mode");
    },
  };
}

// ---------------------------------------------------------------- seed run

async function seed(client, content) {
  const stats = { inserted: 0, skipped: 0, updated: 0 };

  // ensure: find by natural key → insert (or update when --force)
  async function ensure(table, key, row, extra, returnId = true) {
    const existingId = await client.find(table, key);
    if (existingId) {
      if (FORCE && extra && Object.keys(extra).length > 0) {
        await client.update(table, key, extra);
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
      return existingId;
    }
    stats.inserted += 1;
    return client.insert(table, { ...key, ...row }, returnId);
  }

  // --- course
  const courseId = await ensure(
    "courses",
    { code: content.course.code },
    {
      title: content.course.title,
      description: content.course.description,
      status: "published",
      enrolment_open: true,
    },
    { title: content.course.title, description: content.course.description, status: "published" },
  );

  // --- modules (positions 1–7, verbatim titles)
  const moduleIds = {};
  for (const [pos, title] of Object.entries(MODULES)) {
    moduleIds[pos] = await ensure(
      "modules",
      { course_id: courseId, position: Number(pos) },
      { title, status: "published" },
      { title, status: "published" },
    );
  }

  // --- chapters (14, verbatim titles, slugified)
  const chapterIds = {};
  for (const ch of content.chapters) {
    const modId = moduleIds[String(ch.module)];
    try {
      chapterIds[ch.chapter] = await ensure(
        "chapters",
        { module_id: modId, slug: slugify(ch.title) },
        { position: ch.position, title: ch.title, status: "published" },
        { position: ch.position, title: ch.title, status: "published" },
      );
    } catch (err) {
      console.error(`[ERROR] Failed on chapter ${ch.chapter}:`, err);
      throw err;
    }
  }

  // --- assessment weight settings (source: Assessment & Examination Guide)
  const weightSettings = [
    ["weight_indexing_practicum", 20, "Indexing Practicum weight (%) — source: Assessment & Examination Guide"],
    ["weight_abstracting_portfolio", 15, "Abstracting Portfolio weight (%) — source: Assessment & Examination Guide"],
    ["weight_mid_term", 15, "Mid-Term Assessment weight (%) — source: Assessment & Examination Guide"],
    ["weight_final_exam", 50, "Final Examination weight (%) — source: Assessment & Examination Guide"],
  ];
  for (const [key, value, description] of weightSettings) {
    await ensure(
      "system_settings",
      { key },
      { value: J(value), description, is_secret: false },
      { value: J(value) },
      false,
    );
  }

  // --- glossary (Appendix C)
  for (const term of content.glossary.terms) {
    await ensure(
      "glossary_terms",
      { course_id: courseId, slug: slugify(term.term) },
      {
        term: term.term,
        definition: term.definition,
        source: term.source,
        position: term.position,
        module_id: null,
      },
      { term: term.term, definition: term.definition, position: term.position },
    );
  }

  // --- practical activities (Appendix A)
  for (const activity of content.practicals.activities) {
    const existing = await client.find("practical_activities", { course_id: courseId, title: activity.title });
    if (existing) {
      stats.skipped += 1;
      continue;
    }
    stats.inserted += 1;
    await client.insert("practical_activities", {
      course_id: courseId,
      chapter_id: null,
      title: activity.title,
      instructions_md: activity.instructions_md,
      rubric: {},
      is_required: false,
      position: activity.position,
      status: "published",
    });
  }

  // --- resource categories (the group headings on the learner resources page)
  const categoryIds = new Map();
  const categoryTitles = [];
  for (const item of content.resources.items) {
    const title = typeof item.category === "string" ? item.category.trim() : "";
    if (title && !categoryTitles.includes(title)) categoryTitles.push(title);
  }
  let categoryPosition = 0;
  for (const title of categoryTitles) {
    const id = await ensure(
      "resource_categories",
      { course_id: courseId, title },
      { position: categoryPosition, status: "published" },
      {},
    );
    if (id) categoryIds.set(title, id);
    categoryPosition += 1;
  }

  // --- resources (student files/links; exam papers stay staff-only)
  for (const item of content.resources.items) {
    const filePath = item.storage_path ? path.join(ROOT, item.storage_path) : null;
    const size = filePath && fs.existsSync(filePath) ? fs.statSync(filePath).size : null;
    const categoryId =
      typeof item.category === "string" && item.category.trim()
        ? categoryIds.get(item.category.trim()) ?? null
        : null;
    await ensure(
      "resources",
      { course_id: courseId, title: item.title },
      {
        description: item.description,
        kind: item.kind,
        category_id: categoryId,
        visibility: item.visibility,
        source: item.source,
        storage_path: item.storage_path ?? null,
        url: item.url ?? null,
        mime_type: item.mime_type ?? null,
        size_bytes: size,
        status: "published",
        module_id: null,
        chapter_id: null,
        lesson_id: null,
      },
      {
        description: item.description,
        category_id: categoryId,
        visibility: item.visibility,
        storage_path: item.storage_path ?? null,
        url: item.url ?? null,
        size_bytes: size,
      },
    );
  }

  // --- announcements (course news; publish_at/status are enforced by RLS)
  for (const item of content.announcements.items) {
    await ensure(
      "announcements",
      { course_id: courseId, title: item.title },
      {
        body_md: item.body_md,
        audience: item.audience,
        pinned: Boolean(item.pinned),
        status: item.status,
        created_by: null,
      },
      { body_md: item.body_md, pinned: Boolean(item.pinned) },
    );
  }

  // --- knowledge-check assessments (one per chapter) + questions
  const knowledgeAssessmentIds = {};
  for (const k of content.knowledge) {
    const title = `Chapter ${k.chapter} — Knowledge check`;
    knowledgeAssessmentIds[k.chapter] = await ensure(
      "assessments",
      { course_id: courseId, title },
      {
        type: "knowledge_check",
        description: "Formative check on this chapter. Unlimited attempts; 70% to continue.",
        pass_mark: 70,
        max_attempts: null,
        randomize_questions: true,
        randomize_options: true,
        show_correct_answers: true,
        prerequisite: "none",
        status: "published",
        settings: { source: "lms-authored", chapter: k.chapter },
      },
      { description: "Formative check on this chapter. Unlimited attempts; 70% to continue." },
    );

    for (const q of k.questions) {
      const existing = await client.find("questions", {
        assessment_id: knowledgeAssessmentIds[k.chapter],
        position: q.n,
      });
      if (existing) {
        stats.skipped += 1;
        continue;
      }
      stats.inserted += 1;
      const questionId = await client.insert("questions", {
        assessment_id: knowledgeAssessmentIds[k.chapter],
        bank_id: null,
        module_id: moduleIds[String(CHAPTER_MODULE(k.chapter))],
        chapter_id: chapterIds[k.chapter],
        stem_md: q.stem,
        type: "mcq",
        points: 1,
        explanation_md: q.explanation ?? null,
        source: "lms-authored",
        source_ref: `Ch${k.chapter} review`,
        position: q.n,
        status: "published",
      });
      for (const label of ["A", "B", "C", "D"]) {
        await client.insert("question_options", {
          question_id: questionId,
          label,
          text: q.options[label],
          position: label.charCodeAt(0) - 65,
          is_correct: q.answer === label,
        });
      }
    }
  }

  // --- objective examination (100 supplied MCQs)
  const objectiveId = await ensure(
    "assessments",
    { course_id: courseId, title: content.objective.title },
    {
      type: "objective",
      description: "100 multiple-choice questions, 1 mark each, 90 minutes.",
      duration_minutes: content.objective.duration_minutes,
      pass_mark: content.objective.pass_mark,
      randomize_questions: true,
      randomize_options: true,
      show_correct_answers: false,
      prerequisite: "all_lessons",
      status: "published",
      settings: { instructions: content.objective.instructions, source: "supplied" },
    },
    { duration_minutes: content.objective.duration_minutes, pass_mark: content.objective.pass_mark },
  );

  for (const q of content.objective.questions) {
    const existing = await client.find("questions", { assessment_id: objectiveId, position: q.n });
    if (existing) {
      stats.skipped += 1;
      continue;
    }
    stats.inserted += 1;
    const questionId = await client.insert("questions", {
      assessment_id: objectiveId,
      bank_id: null,
      module_id: moduleIds[String(q.module)],
      chapter_id: chapterIds[q.chapter] ?? null,
      stem_md: q.stem,
      type: "mcq",
      points: 1,
      explanation_md: null,
      source: "supplied",
      source_ref: q.source_ref,
      position: q.n,
      status: "published",
    });
    for (const label of ["A", "B", "C", "D"]) {
      await client.insert("question_options", {
        question_id: questionId,
        label,
        text: q.options[label],
        position: label.charCodeAt(0) - 65,
        is_correct: q.answer === label,
      });
    }
  }

  // --- theory examination (7 supplied questions, model answers staff-side)
  const theoryId = await ensure(
    "assessments",
    { course_id: courseId, title: content.theory.title },
    {
      type: "theory",
      description: "Answer exactly FIVE of SEVEN questions. 20 marks each, 2 hours.",
      duration_minutes: content.theory.duration_minutes,
      pass_mark: 50,
      randomize_questions: false,
      randomize_options: false,
      show_correct_answers: false,
      prerequisite: "all_lessons",
      status: "published",
      settings: {
        instructions: content.theory.instructions,
        answer_any: 5,
        total: 7,
        marks_each: 20,
        model_answer_note: content.theory.model_answer_note,
        source: "supplied",
      },
    },
    { duration_minutes: content.theory.duration_minutes },
  );

  for (const q of content.theory.questions) {
    const existing = await client.find("questions", { assessment_id: theoryId, position: q.n });
    if (existing) {
      stats.skipped += 1;
      continue;
    }
    stats.inserted += 1;
    await client.insert("questions", {
      assessment_id: theoryId,
      bank_id: null,
      module_id: moduleIds[String(q.module)],
      chapter_id: null,
      stem_md: q.stem_md,
      type: "essay",
      points: 20,
      explanation_md: null,
      model_answer_md: q.model_answer_md,
      source: "supplied",
      source_ref: q.source_ref,
      position: q.n,
      status: "published",
    });
  }

  // --- revision centre (Appendix B) as a question bank
  const bankId = await ensure(
    "question_banks",
    { course_id: courseId, name: "Revision Centre — Appendix B" },
    { description: "Short-answer and essay self-test questions with model answers (revealed on demand)." },
    {},
  );

  let revisionPosition = 0;
  for (const item of content.revision.short_answer) {
    revisionPosition += 1;
    const existing = await client.find("questions", { bank_id: bankId, position: revisionPosition });
    if (existing) {
      stats.skipped += 1;
      continue;
    }
    stats.inserted += 1;
    await client.insert("questions", {
      bank_id: bankId,
      assessment_id: null,
      module_id: null,
      chapter_id: null,
      stem_md: item.question_md,
      type: "short",
      points: 1,
      explanation_md: null,
      model_answer_md: item.model_answer_md,
      source: "supplied",
      source_ref: `App B SA${item.n}`,
      position: revisionPosition,
      status: "published",
    });
  }
  for (const item of content.revision.essay) {
    revisionPosition += 1;
    const existing = await client.find("questions", { bank_id: bankId, position: revisionPosition });
    if (existing) {
      stats.skipped += 1;
      continue;
    }
    stats.inserted += 1;
    await client.insert("questions", {
      bank_id: bankId,
      assessment_id: null,
      module_id: null,
      chapter_id: null,
      stem_md: item.question_md,
      type: "essay",
      points: 20,
      explanation_md: null,
      model_answer_md: null,
      source: "supplied",
      source_ref: `App B Essay${item.n}`,
      position: revisionPosition,
      status: "published",
    });
  }

  // --- lessons: per chapter → reading (position 1) then knowledge check (position 2)
  const lessonSequence = [];
  for (const ch of content.chapters) {
    const readingKey = { chapter_id: chapterIds[ch.chapter], position: 1 };
    const readingId = await ensure(
      "lessons",
      readingKey,
      {
        title: ch.title,
        kind: "reading",
        is_required: true,
        est_minutes: Number(ch.estimated_minutes) || 20,
        required_reading_pct: Number(ch.required_reading_pct) || 90,
        min_seconds: 0,
        required_assessment_id: null,
        status: "published",
      },
      {
        title: ch.title,
        est_minutes: Number(ch.estimated_minutes) || 20,
        required_reading_pct: Number(ch.required_reading_pct) || 90,
      },
    );
    lessonSequence.push(readingId);

    const checkKey = { chapter_id: chapterIds[ch.chapter], position: 2 };
    const checkId = await ensure(
      "lessons",
      checkKey,
      {
        title: `Knowledge check — Chapter ${ch.chapter}`,
        kind: "check",
        is_required: true,
        est_minutes: 10,
        required_reading_pct: 90,
        min_seconds: 0,
        required_assessment_id: knowledgeAssessmentIds[ch.chapter],
        required_assessment_min_score: 70,
        status: "published",
      },
      { required_assessment_id: knowledgeAssessmentIds[ch.chapter] },
    );
    lessonSequence.push(checkId);

    // --- sections of the reading lesson
    for (let i = 0; i < ch.sections.length; i += 1) {
      const section = ch.sections[i];
      const key = { lesson_id: readingId, position: i + 1 };
      await ensure(
        "lesson_sections",
        key,
        {
          kind: section.kind,
          title: section.title,
          content_md: section.content,
          is_required: true,
          estimated_words: section.content.split(/\s+/).filter(Boolean).length,
        },
        { kind: section.kind, title: section.title, content_md: section.content },
      );
    }
  }

  // --- prerequisite chain: first lesson open, every later lesson needs the previous one
  for (let i = 1; i < lessonSequence.length; i += 1) {
    const lessonId = lessonSequence[i];
    const previousId = lessonSequence[i - 1];
    const already = await client.exists("lesson_prerequisites", {
      lesson_id: lessonId,
      prerequisite_lesson_id: previousId,
    });
    if (already) {
      stats.skipped += 1;
      continue;
    }
    stats.inserted += 1;
    await client.insert(
      "lesson_prerequisites",
      { lesson_id: lessonId, prerequisite_lesson_id: previousId },
      false,
    );
  }

  return stats;
}

// ---------------------------------------------------------------- report

async function report(client) {
  const counts = {};
  for (const table of [
    "courses",
    "modules",
    "chapters",
    "lessons",
    "lesson_sections",
    "lesson_prerequisites",
    "assessments",
    "questions",
    "question_options",
    "glossary_terms",
    "practical_activities",
    "resources",
    "announcements",
    "system_settings",
  ]) {
    counts[table] = await client.count(table);
  }
  return counts;
}

function printCounts(label, counts) {
  console.log(`\n${label}`);
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(24)} ${n}`);
  }
}

const EXPECTED = {
  courses: 1,
  modules: 7,
  chapters: 14,
  lessons: 28,
  lesson_prerequisites: 27,
  assessments: 16,
  questions: 202,
  question_options: 680,
  glossary_terms: 42,
  practical_activities: 9,
  resources: 4,
  announcements: 3,
};

function assertCounts(counts) {
  const problems = [];
  for (const [table, expected] of Object.entries(EXPECTED)) {
    if (counts[table] !== expected) problems.push(`${table}: expected ${expected}, found ${counts[table]}`);
  }
  return problems;
}

// ---------------------------------------------------------------- main

async function main() {
  const content = loadContent();

  console.log("LIS 815 LMS — content seeder");
  console.log(
    `Parsed: ${content.chapters.length} chapters, ` +
      `${content.knowledge.reduce((n, k) => n + k.questions.length, 0)} knowledge MCQs, ` +
      `${content.objective.questions.length} objective MCQs, ` +
      `${content.theory.questions.length} theory questions, ` +
      `${content.glossary.terms.length} glossary terms, ` +
      `${content.practicals.activities.length} practicals, ` +
      `${content.revision.short_answer.length}+${content.revision.essay.length} revision items, ` +
      `${content.resources.items.length} resources, ` +
      `${content.announcements.items.length} announcements, ` +
      `${content.orientation.length} orientation pages (static, not seeded)`,
  );

  if (DRY) {
    console.log("\n--dry-run: no database touched. Row plan:");
    console.log("  1 course · 7 modules · 14 chapters · 28 lessons · sections = Σ chapter headings");
    console.log("  16 assessments · 202 questions · 680 options · 42 glossary · 9 practicals · 4 weight settings");
    console.log("  4 resources (2 student, 2 staff exam papers) · 3 announcements");
    return;
  }

  if (PGLITE) {
    const { createMigratedDb } = await import("./validate-sql.mjs");
    const db = await createMigratedDb();
    const client = await pgliteClient(db);

    console.log("\n[1/3] migrations applied to a throwaway local Postgres (PGlite)");
    const first = await seed(client, content);
    console.log(`      seed run 1: +${first.inserted} inserted, ${first.skipped} skipped, ${first.updated} updated`);
    const counts1 = await report(client);
    printCounts("[2/3] counts after run 1", counts1);

    const second = await seed(client, content);
    const counts2 = await report(client);
    console.log(`\n[3/3] seed run 2: +${second.inserted} inserted, ${second.skipped} skipped, ${second.updated} updated`);

    const problems = [];
    if (second.inserted !== 0) problems.push(`second run inserted ${second.inserted} rows (expected 0 — not idempotent)`);
    for (const [table, n] of Object.entries(counts1)) {
      if (counts2[table] !== n) problems.push(`${table} changed between runs (${n} → ${counts2[table]})`);
    }
    problems.push(...assertCounts(counts2));

    if (problems.length) {
      console.error("\nFAILED:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    console.log("\nAll seed checks passed: correct counts, zero duplicates on re-run.");
    await db.close();
    return;
  }

  const client = await supabaseClient();
  const stats = await seed(client, content);
  console.log(`\nSeed complete: +${stats.inserted} inserted, ${stats.skipped} already present, ${stats.updated} updated${FORCE ? " (--force)" : ""}`);
  printCounts("Project counts", await report(client));
  const problems = assertCounts(await report(client));
  if (problems.length) {
    console.error("\nUnexpected counts:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("\nFATAL:", e.message);
    process.exit(1);
  });
}
