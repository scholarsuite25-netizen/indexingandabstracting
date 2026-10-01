#!/usr/bin/env node
// LIS 815 content validator — npm run check:content
// Structural checks + source-fidelity fuzzy diff against docs/extracted/*.txt

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const EXTRACTED = path.join(ROOT, "docs", "extracted");

let failures = 0;
let passes = 0;

function pass(msg) {
  passes += 1;
  console.log(`  PASS  ${msg}`);
}
function fail(msg) {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
}
function info(msg) {
  console.log(`        ${msg}`);
}

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\u00ad/g, "")
    .replace(/[^a-z0-9]+/g, "");

function read(file) {
  return fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(full, ext);
      return entry.name.endsWith(ext) ? [full] : [];
    })
    .sort();
}

// --- minimal frontmatter parser (key: value scalars) ---
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else if (/^-?\d+$/.test(value)) {
      value = Number(value);
    } else if (value === "true" || value === "false") {
      value = value === "true";
    }
    data[kv[1]] = value;
  }
  return { data, body: match[2] };
}

// --- expected structure from the source table of contents ---
const MODULES = {
  1: { title: "Theoretical Foundations and Types of Indexes", chapters: [1, 2, 3] },
  2: { title: "Vocabulary Control", chapters: [4, 5] },
  3: { title: "Pre-Coordinate Indexing Systems", chapters: [6, 7] },
  4: { title: "Post-Coordinate and Derived Indexing", chapters: [8, 9] },
  5: { title: "Performance Evaluation and System Metrics", chapters: [10, 11] },
  6: { title: "Abstracting Principles and Applications", chapters: [12, 13] },
  7: { title: "Digital, Automated and AI-Assisted Indexing", chapters: [14] },
};

const CHAPTERS = {
  1: "Fundamentals and Objectives of Subject Indexing",
  2: "Types of Indexes and Book Indexing",
  3: "Semantics and Syntax in Assigned Indexing",
  4: "Thesaurus Construction: Design and Term Selection",
  5: "Thesaurus Construction: Structure and Maintenance",
  6: "Classic Pre-Coordinate Techniques",
  7: "Permuted and Algorithmic Systems",
  8: "Post-Coordinate Indexing Systems",
  9: "Search Strategies and Derived Indexing",
  10: "Evaluation Methodologies",
  11: "Precision, Recall and Search Optimisation",
  12: "Abstracting Techniques and Types",
  13: "Uses and Applications of Abstracts",
  14: "Automatic Indexing, Computer-Assisted Tools and Artificial Intelligence",
};

const chapterModule = (n) => Number(Object.keys(MODULES).find((m) => MODULES[m].chapters.includes(n)));

// --- load the extracted sources for fuzzy checks ---
const ebook = read(path.join(EXTRACTED, "Indexing_and_Abstracting_Complete_Ebook.txt"));
const objectiveSrc = read(path.join(EXTRACTED, "LIS_814_Objective_Examination.txt"));
const theorySrc = read(path.join(EXTRACTED, "LIS_814_Theory_Examination.txt"));
const objectiveSourceNorm = norm(objectiveSrc);
const theorySourceNorm = norm(theorySrc);
const ebookNorm = norm(ebook);

console.log("LIS 815 LMS — content validator");
console.log("=".repeat(60));

// ------------------------------------------------------------------
console.log("\n[1] Chapter files (content/core)");
// ------------------------------------------------------------------
const chapterFiles = listFiles(path.join(CONTENT, "core"), ".md");
const seenChapters = new Set();
let sectionProbeTotal = 0;
let sectionProbeHits = 0;

for (const file of chapterFiles) {
  const rel = path.relative(CONTENT, file).replace(/\\/g, "/");
  const raw = read(file);
  const parsed = parseFrontmatter(raw);
  if (!parsed) {
    fail(`${rel}: missing YAML frontmatter`);
    continue;
  }
  const fm = parsed.data;
  const body = parsed.body;
  const n = Number(fm.chapter);
  const label = `${rel}`;

  if (!CHAPTERS[n]) {
    fail(`${label}: frontmatter chapter "${fm.chapter}" not in 1–14`);
    continue;
  }
  if (seenChapters.has(n)) fail(`${label}: chapter ${n} already seen`);
  seenChapters.add(n);

  const checks = [
    [fm.source === "supplied", "source must be 'supplied'"],
    [Number(fm.module) === chapterModule(n), `module must be ${chapterModule(n)}`],
    [fm.title === CHAPTERS[n], `title must be "${CHAPTERS[n]}" (got "${fm.title}")`],
    [fm.id === `chapter-${String(n).padStart(2, "0")}`, `id must be chapter-0${n}`],
    [typeof fm.estimated_minutes === "number" && fm.estimated_minutes > 0, "estimated_minutes required"],
    [Number(fm.required_reading_pct) > 0 && Number(fm.required_reading_pct) <= 100, "required_reading_pct 1–100"],
  ];
  for (const [ok, msg] of checks) if (!ok) fail(`${label}: ${msg}`);

  const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  if (headings.length === 0) {
    fail(`${label}: no "##" sections`);
    continue;
  }
  if (!/^Learning Objectives$/i.test(headings[0])) {
    fail(`${label}: first section must be "## Learning Objectives" (got "${headings[0]}")`);
  }
  const last = headings[headings.length - 1];
  if (!/^Review Questions$/i.test(last)) {
    fail(`${label}: last section must be "## Review Questions" (got "${last}")`);
  }

  const numbered = headings.filter((h) => /^\d+\.\d+\s/.test(h));
  const badNumbering = numbered.filter((h) => !h.startsWith(`${n}.`));
  if (numbered.length === 0) fail(`${label}: no numbered "## ${n}.x" prose sections`);
  if (badNumbering.length > 0) fail(`${label}: sections not matching chapter ${n}: ${badNumbering.join(", ")}`);

  const reviewMatch = body.match(/^##\s+Review Questions\s*$/im);
  if (reviewMatch) {
    const reviewBody = body.slice(reviewMatch.index + reviewMatch[0].length);
    const questions = reviewBody.match(/^\s*\d+\.\s+\S+/gm);
    if (!questions || questions.length < 3) {
      fail(`${label}: review questions count too low (${questions ? questions.length : 0})`);
    }
  }

  // Fidelity: first sentence of each substantial section must exist in the ebook text
  const parts = body.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const text = part.replace(/^.*\n/, "");
    const sentences = text.match(/[^.]+\.[\s"]/);
    const probeSource = String(sentences ? sentences[0] : text).trim();
    if (norm(probeSource).length < 30) continue;
    const probe = norm(probeSource).slice(0, 60);
    sectionProbeTotal += 1;
    if (ebookNorm.includes(probe)) sectionProbeHits += 1;
  }
}
if (seenChapters.size === 14) pass("all 14 chapter files present");
else fail(`expected 14 chapter files, found ${seenChapters.size}: [${[...seenChapters].sort((a, b) => a - b).join(", ")}]`);

// ------------------------------------------------------------------
console.log("\n[2] Knowledge checks (content/assessments/knowledge)");
// ------------------------------------------------------------------
const knowledgeFiles = listFiles(path.join(CONTENT, "assessments", "knowledge"), ".json");
let knowledgeCount = 0;
const knowledgeChapters = new Set();

for (const file of knowledgeFiles) {
  const rel = path.relative(CONTENT, file).replace(/\\/g, "/");
  try {
    const data = JSON.parse(read(file));
    const ch = Number(data.chapter);
    knowledgeChapters.add(ch);
    if (!Array.isArray(data.questions) || data.questions.length !== 5) {
      fail(`${rel}: must contain exactly 5 questions (got ${data.questions?.length})`);
      continue;
    }
    for (const q of data.questions) {
      knowledgeCount += 1;
      const ok =
        q.stem &&
        q.options &&
        ["A", "B", "C", "D"].every((k) => typeof q.options[k] === "string" && q.options[k].trim()) &&
        ["A", "B", "C", "D"].includes(q.answer) &&
        q.explanation;
      if (!ok) fail(`${rel} q${q.n}: needs stem, 4 options, A–D answer, explanation`);
    }
  } catch (error) {
    fail(`${rel}: invalid JSON (${error.message})`);
  }
}
if (knowledgeChapters.size === 14) pass("knowledge checks exist for all 14 chapters");
else fail(`knowledge checks for ${knowledgeChapters.size}/14 chapters (missing: ${[...Array(14)].map((_, i) => i + 1).filter((c) => !knowledgeChapters.has(c)).join(", ") || "none"})`);
if (knowledgeCount === 70) pass("exactly 70 knowledge-check questions (5 × 14 chapters)");
else fail(`expected 70 knowledge-check questions, found ${knowledgeCount}`);

// ------------------------------------------------------------------
console.log("\n[3] Objective paper (content/assessments/objective.json)");
// ------------------------------------------------------------------
try {
  const data = JSON.parse(read(path.join(CONTENT, "assessments", "objective.json")));
  const qs = data.questions;

  if (qs.length === 100) pass("100 questions");
  else fail(`expected 100 questions, found ${qs.length}`);

  const wrongOptions = qs.filter(
    (q) => !q.options || ["A", "B", "C", "D"].some((k) => !q.options[k] || !String(q.options[k]).trim()),
  );
  if (wrongOptions.length === 0) pass("every question has options A–D");
  else fail(`${wrongOptions.length} question(s) missing options: ${wrongOptions.map((q) => q.n).join(", ")}`);

  const wrongKeys = qs.filter((q) => !["A", "B", "C", "D"].includes(q.answer));
  if (wrongKeys.length === 0) pass("all answer keys within A–D");
  else fail(`invalid keys: ${wrongKeys.map((q) => q.n).join(", ")}`);

  const missingMeta = qs.filter((q) => !q.source_ref || !q.module || !q.chapter || q.source !== "supplied");
  if (missingMeta.length === 0) pass("all questions carry source/source_ref/module/chapter");
  else fail(`${missingMeta.length} question(s) missing source metadata: ${missingMeta.map((q) => q.n).slice(0, 10).join(", ")}`);

  const wrongN = qs.filter((q, i) => q.n !== i + 1);
  if (wrongN.length === 0) pass("question numbering 1–100 in order");
  else fail(`numbering out of order at: ${wrongN.map((q) => q.n).join(", ")}`);

  const mismatches = qs.filter((q) => !objectiveSourceNorm.includes(norm(q.stem).slice(0, 45)));
  if (mismatches.length === 0) pass(`fuzzy diff: 100/100 stems match the extracted PDF text`);
  else {
    fail(`fuzzy diff: ${mismatches.length}/100 stems NOT found in source: ${mismatches.map((q) => q.n).join(", ")}`);
    mismatches.slice(0, 5).forEach((q) => info(`Q${q.n}: "${String(q.stem).slice(0, 70)}…"`));
  }

  const optionMismatches = qs.filter((q) =>
    ["A", "B", "C", "D"].some((k) => !objectiveSourceNorm.includes(norm(q.options[k]).slice(0, 30))),
  );
  if (optionMismatches.length === 0) pass("fuzzy diff: all 400 option texts match the source");
  else fail(`fuzzy diff: options not found in source for Q: ${optionMismatches.map((q) => q.n).join(", ")}`);
} catch (error) {
  fail(`objective.json: ${error.message}`);
}

// ------------------------------------------------------------------
console.log("\n[4] Theory paper (content/assessments/theory.json)");
// ------------------------------------------------------------------
try {
  const data = JSON.parse(read(path.join(CONTENT, "assessments", "theory.json")));
  const qs = data.questions;

  if (qs.length === 7) pass("7 questions");
  else fail(`expected 7 theory questions, found ${qs.length}`);

  for (const q of qs) {
    const sum = (q.parts || []).reduce((total, part) => total + Number(part.marks || 0), 0);
    if (sum !== 20) fail(`Q${q.n}: parts sum to ${sum} marks (must be 20)`);
    if (Number(q.total_marks) !== 20) fail(`Q${q.n}: total_marks must be 20`);
    if (!q.model_answer_md || q.model_answer_md.trim().length < 40) fail(`Q${q.n}: missing/short model answer`);
    if (q.source !== "supplied" || !q.source_ref) fail(`Q${q.n}: must be source=supplied with source_ref`);
    if (!q.module || q.module < 1 || q.module > 7) fail(`Q${q.n}: module must be 1–7`);
    const probe = norm(q.stem_md.split("\n")[0]).slice(0, 40);
    if (probe && !theorySourceNorm.includes(probe)) info(`Q${q.n} stem probe not found (check verbatim): ${q.stem_md.split("\n")[0]}`);
  }
  if (qs.every((q) => (q.parts || []).reduce((t, p) => t + Number(p.marks || 0), 0) === 20)) {
    pass("every question's sub-marks sum to 20");
  }

  const modelProbe = norm(data.model_answer_note || "");
  if (!modelProbe) fail("model_answer_note (examiner caveat) missing from theory.json");
  else pass("examiner caveat kept as model_answer_note");
} catch (error) {
  fail(`theory.json: ${error.message}`);
}

// ------------------------------------------------------------------
console.log("\n[5] Glossary / practicals / revision (Appendices A–C)");
// ------------------------------------------------------------------
try {
  const data = JSON.parse(read(path.join(CONTENT, "glossary", "glossary.json")));
  const sourceTerms = ebook
    .slice(ebook.lastIndexOf("Appendix C: Glossary"), ebook.lastIndexOf("Assessment and Examination Guide"))
    .split("\n")
    .filter((l) => l.includes(" — "))
    .length;

  if (data.terms.length === sourceTerms)
    pass(`glossary: ${data.terms.length} terms — matches the source (${sourceTerms})`);
  else fail(`glossary: ${data.terms.length} terms, source has ${sourceTerms}`);

  if (data.terms.length !== 53)
    info(`NOTE: plan assumed 53 terms; source actually has ${sourceTerms} — logged in content/ISSUES.md`);

  const bad = data.terms.filter(
    (t) => !t.term || !t.definition || t.source !== "supplied" || typeof t.position !== "number",
  );
  if (bad.length === 0) pass("every glossary term has term/definition/source/position");
  else fail(`${bad.length} glossary entries incomplete`);
} catch (error) {
  fail(`glossary.json: ${error.message}`);
}

try {
  const data = JSON.parse(read(path.join(CONTENT, "practicals", "practicals.json")));
  const bad = data.activities.filter(
    (a) => !a.title || !a.instructions_md || a.source !== "supplied" || typeof a.position !== "number",
  );
  if (data.activities.length >= 7) pass(`practicals: ${data.activities.length} activities from Appendix A`);
  else fail(`practicals: expected ≥7 activities, found ${data.activities.length}`);
  if (bad.length === 0) pass("every practical activity complete");
  else fail(`${bad.length} practical activities incomplete`);
} catch (error) {
  fail(`practicals.json: ${error.message}`);
}

try {
  const data = JSON.parse(read(path.join(CONTENT, "revision", "revision.json")));
  const src = ebook.slice(ebook.lastIndexOf("Appendix B:"), ebook.lastIndexOf("Appendix C:"));
  const shortIdx = src.indexOf("Short-Answer Questions");
  const modelIdx = src.indexOf("Model Answers", shortIdx);
  const srcShort = src.slice(shortIdx, modelIdx);
  const expectedShort = (srcShort.match(/^\s*\d+\.\s+\S/gm) || []).length;
  const srcEssay = src.slice(src.indexOf("Essay Questions"), src.indexOf("A Model Comparison Outline"));
  const expectedEssay = (srcEssay.match(/^\s*\d+\.\s+\S/gm) || []).length;

  if (data.short_answer.length === expectedShort)
    pass(`revision: ${data.short_answer.length} short-answer questions (source: ${expectedShort})`);
  else fail(`revision short-answer: ${data.short_answer.length}, source has ${expectedShort}`);

  if (data.essay.length === expectedEssay)
    pass(`revision: ${data.essay.length} essay questions (source: ${expectedEssay})`);
  else fail(`revision essay: ${data.essay.length}, source has ${expectedEssay}`);

  const missingAnswers = data.short_answer.filter(
    (s) => !s.model_answer_md || s.model_answer_md.trim().length < 10,
  );
  if (missingAnswers.length === 0) pass("every short-answer question has a model answer");
  else fail(`missing model answers for: ${missingAnswers.map((s) => s.n).join(", ")}`);

  if (!data.model_outline_md || data.model_outline_md.trim().length < 100)
    fail("model_outline_md (A Model Comparison Outline) missing");
  else pass("model comparison outline kept");
} catch (error) {
  fail(`revision.json: ${error.message}`);
}

// ------------------------------------------------------------------
console.log("\n[6] Orientation + labels + issues");
// ------------------------------------------------------------------
const orientationFiles = listFiles(path.join(CONTENT, "orientation"), ".md");
if (orientationFiles.length >= 6) pass(`orientation: ${orientationFiles.length} static pages`);
else fail(`orientation: expected ≥6 pages, found ${orientationFiles.length}`);

for (const file of [...chapterFiles, ...orientationFiles]) {
  const rel = path.relative(CONTENT, file).replace(/\\/g, "/");
  const parsed = parseFrontmatter(read(file));
  if (!parsed) continue;
  const source = parsed.data.source;
  if (!["supplied", "lms-authored", "supplementary"].includes(source)) {
    fail(`${rel}: source must be supplied | lms-authored | supplementary (got "${source}")`);
  }
}
pass("all content files carry a valid source label (checked above)");

const issuesPath = path.join(CONTENT, "ISSUES.md");
if (fs.existsSync(issuesPath) && read(issuesPath).trim().length > 40) {
  pass("content/ISSUES.md exists and is populated");
} else {
  fail("content/ISSUES.md missing or empty (every ambiguity must be logged)");
}

// section fidelity coverage
const coverage = sectionProbeTotal === 0 ? 0 : sectionProbeHits / sectionProbeTotal;
if (sectionProbeTotal > 0) {
  if (coverage >= 0.8) {
    pass(`section fidelity: ${(coverage * 100).toFixed(1)}% of section openings found verbatim in the ebook (${sectionProbeHits}/${sectionProbeTotal})`);
  } else {
    fail(`section fidelity only ${(coverage * 100).toFixed(1)}% (${sectionProbeHits}/${sectionProbeTotal}) — re-read FORMAT.md rule 1: text must be verbatim`);
  }
}

// ------------------------------------------------------------------
console.log("\n[7] Resources and announcements (Phase 8)");

function readJson(rel) {
  const file = path.join(CONTENT, rel);
  if (!fs.existsSync(file)) {
    fail(`${rel} is missing`);
    return null;
  }
  try {
    return JSON.parse(read(file));
  } catch (e) {
    fail(`${rel} is not valid JSON: ${e.message}`);
    return null;
  }
}

const validSources = ["supplied", "lms-authored", "supplementary"];
const resourceFile = readJson("resources/resources.json");
const resourceItems = resourceFile?.items ?? [];
if (resourceItems.length > 0) pass(`resources: ${resourceItems.length} items`);
else fail("resources: no items found in content/resources/resources.json");

const resourceProblems = [];
for (const item of resourceItems) {
  const label = item.title || "(untitled resource)";
  if (item.category !== undefined) {
    if (typeof item.category !== "string" || item.category.trim() === "") {
      resourceProblems.push(`${label}: category must be a non-empty name (got ${JSON.stringify(item.category)})`);
    } else if (item.category.trim().length > 60) {
      resourceProblems.push(`${label}: category name is too long (max 60 characters)`);
    }
  }
  if (!["file", "link", "exam_paper"].includes(item.kind)) {
    resourceProblems.push(`${label}: kind must be file | link | exam_paper (got "${item.kind}")`);
  }
  if (!["students", "staff"].includes(item.visibility)) {
    resourceProblems.push(`${label}: visibility must be students | staff (got "${item.visibility}")`);
  }
  if (!validSources.includes(item.source)) {
    resourceProblems.push(`${label}: source must be supplied | lms-authored | supplementary (got "${item.source}")`);
  }
  if (item.kind === "exam_paper" && item.visibility !== "staff") {
    resourceProblems.push(`${label}: an examination paper must be staff-only (got "${item.visibility}")`);
  }
  if (item.kind === "file") {
    if (!item.storage_path) resourceProblems.push(`${label}: a file needs storage_path`);
    else if (!fs.existsSync(path.join(ROOT, item.storage_path))) {
      resourceProblems.push(`${label}: storage_path ${item.storage_path} is not in the repository`);
    }
  }
  if (item.kind === "link" && !item.url) resourceProblems.push(`${label}: a link needs url`);
}
for (const problem of resourceProblems) fail(problem);
if (resourceProblems.length === 0 && resourceItems.length > 0) {
  pass("every resource is a well-formed file, link or staff-only paper");
}
if (resourceItems.some((item) => item.visibility === "students")) {
  pass("at least one resource is published to students");
} else {
  fail("no resource is visible to students");
}

const announcementFile = readJson("announcements/announcements.json");
const announcementItems = announcementFile?.items ?? [];
if (announcementItems.length > 0) pass(`announcements: ${announcementItems.length} items`);
else fail("announcements: no items found in content/announcements/announcements.json");

const announcementProblems = [];
if (!validSources.includes(announcementFile?.source)) {
  // The file carries the label once: course news is written here, not transcribed.
  announcementProblems.push(
    `announcements.json source must be ${validSources.join(" | ")} (got "${announcementFile?.source}")`,
  );
}
for (const item of announcementItems) {
  const label = item.title || "(untitled announcement)";
  if (!item.title) announcementProblems.push("an announcement has no title");
  if (!item.body_md || item.body_md.trim().length < 20) {
    announcementProblems.push(`${label}: body_md is missing or too short`);
  }
  if (!["all", "enrolled"].includes(item.audience)) {
    announcementProblems.push(`${label}: audience must be all | enrolled (got "${item.audience}")`);
  }
  if (!["draft", "published", "archived"].includes(item.status)) {
    announcementProblems.push(`${label}: status must be draft | published | archived (got "${item.status}")`);
  }
  if (item.publish_at && Number.isNaN(Date.parse(item.publish_at))) {
    announcementProblems.push(`${label}: publish_at is not a date`);
  }
}
for (const problem of announcementProblems) fail(problem);
if (announcementProblems.length === 0 && announcementItems.length > 0) {
  pass("every announcement has a body, an audience and a status");
}
if (announcementItems.some((item) => item.status === "published")) {
  pass("at least one announcement is published");
} else {
  fail("no announcement is published, so the page would open empty");
}

// ------------------------------------------------------------------
console.log("=".repeat(60));
if (failures === 0) {
  console.log(`All content checks passed (${passes} checks).`);
  process.exit(0);
} else {
  console.log(`${failures} FAILURE(S), ${passes} passed.`);
  process.exit(1);
}
