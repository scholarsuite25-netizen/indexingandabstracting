# LIS 815 content format (Phase 4; resources and announcements added in Phase 8)

Everything the LMS teaches lives in this `content/` folder as plain files, then `npm run db:seed`
pushes it into the database. Two rules override everything below:

1. **Verbatim.** Text marked `source: supplied` is transcribed word-for-word from
   `docs/extracted/*.txt` (the extracted source PDFs). Only whitespace/formatting changes are
   allowed: re-wrapped paragraphs, `•` → `-`, headings normalised to `##`. Never reword, "improve"
   or silently fix the source.
2. **Label everything.** Every file carries `source:` — `supplied` (from the PDFs), `lms-authored`
   (our own words, e.g. knowledge-check MCQs), or `supplementary` (enrichment, never examinable).
   Anything ambiguous goes in `content/ISSUES.md` — never a silent fix.

---

## 1. Chapter files — `content/core/module-0X/chapter-0Y.md`

One file per chapter (14 in total). Frontmatter + Markdown body:

```markdown
---
id: chapter-04
source: supplied
module: 4
chapter: 4
title: "Thesaurus Construction: Design and Term Selection"
position: 1
estimated_minutes: 35
required_reading_pct: 90
---

## Learning Objectives

By the end of this chapter, you should be able to:
- Define controlled vocabulary … (verbatim bullets)

## 4.1 What Is a Controlled Vocabulary?

Paragraph text, reflowed from the source line-wrap ….

## EXAMPLE

A paper titled “…” … (boxed EXAMPLE blocks from the source)

## WORKED EXAMPLE

…

## FORMULA

…

## 4.2 …

…

## Review Questions

1. …
2. …
```

Section-heading rules (the importer maps `##` headings to `lesson_sections.kind`):

| Heading | kind |
|---|---|
| `## Learning Objectives` (must be first) | `objectives` |
| `## N.M …` (numbered section, number must match chapter number) | `prose` |
| `## EXAMPLE`, `## WORKED EXAMPLE`, `## Case …` | `example` |
| `## FORMULA` / `## Formula …` | `formula` |
| `## Try it`, `## Exercise`, `## Practice` | `exercise` |
| `## Review Questions` (must be last, at least one question) | `exercise` |
| any other `##` heading | `prose` |

Details:
- Strip the PDF page furniture: `===== PAGE n =====`, running heads
  (`LIS 815 • INDEXING AND ABSTRACTING`, `A Beginner-Friendly Guide to LIS 815`), page numbers.
- Keep smart quotes/ellipsis characters as they appear in the source (UTF-8).
- Keep scholar citations, numbers, formulas and list items exactly.
- `title` must match the source table of contents exactly.

## 2. Knowledge checks — `content/assessments/knowledge/chapter-0Y.json`

Exactly **5** MCQs per chapter, `source: lms-authored`, written from that chapter's Review
Questions (so the distractors teach). Not copies of the objective paper.

```json
{
  "chapter": 4,
  "questions": [
    {
      "n": 1,
      "stem": "Which relationship indicates a more specific concept in a thesaurus?",
      "options": { "A": "Broader Term", "B": "Narrower Term", "C": "Related Term", "D": "Used For" },
      "answer": "B",
      "explanation": "NT (Narrower Term) points down the hierarchy …"
    }
  ]
}
```

Rules: exactly 4 options (A–D), exactly one `answer`, key within A–D, explanation required.

## 3. Objective paper — `content/assessments/objective.json`

All 100 questions + the supplied key, verbatim; `source_ref` uses the paper numbering.

```json
{
  "title": "Objective Examination",
  "duration_minutes": 90,
  "pass_mark": 50,
  "instructions": ["This paper contains ONE HUNDRED (100) objective questions.", "…"],
  "questions": [
    {
      "n": 1,
      "stem": "Subject indexing is best defined as:",
      "options": { "A": "…", "B": "…", "C": "…", "D": "…" },
      "answer": "B",
      "source": "supplied",
      "source_ref": "Obj Q1",
      "module": 1,
      "chapter": 1
    }
  ]
}
```

- `module`/`chapter` come from **BUILD_PLAN.md Appendix A** (question → chapter map).
- The answer key is the `100. C` list at the end of `LIS_814_Objective_Examination.txt`.

## 4. Theory paper — `content/assessments/theory.json`

```json
{
  "title": "Theory Examination",
  "duration_minutes": 120,
  "instructions": ["This paper contains SEVEN (7) questions.", "Answer any FIVE (5) questions only.", "…"],
  "questions": [
    {
      "n": 1,
      "module": 1,
      "module_label": "Module 1 — Foundations and Types of Indexes",
      "stem_md": "Question 1 (Module 1 …)\n(a) … (6 marks)\n(b) … (6 marks)\n(c) … (8 marks)",
      "parts": [ { "label": "(a)", "text_md": "…", "marks": 6 }, "…" ],
      "total_marks": 20,
      "model_answer_md": "…verbatim model answer text…",
      "source": "supplied",
      "source_ref": "Theory Q1"
    }
  ]
}
```

- Exactly 7 questions; each `parts[].marks` set must sum to **20**; `model_answer_md` is staff-only
  until released (academic integrity).
- The examiner caveat ("Answers are indicative rather than exhaustive…") is kept as
  `model_answer_note` on the file, not inside answers.

## 5. Glossary — `content/glossary/glossary.json`

```json
{ "terms": [ { "term": "Abstract", "definition": "A concise representation of a document’s content.", "source": "supplied", "position": 1 } ] }
```

Transcribe Appendix C in order, term and definition verbatim.

## 6. Practicals — `content/practicals/practicals.json`

Appendix A: grouped exercises (Thesaurus Construction, Indexing Practice, …). One entry per
numbered/independent exercise; `group` keeps the source heading; instructions verbatim.

```json
{ "activities": [ { "n": 1, "group": "Thesaurus Construction", "title": "…", "instructions_md": "…", "source": "supplied", "position": 1 } ] }
```

## 7. Revision centre — `content/revision/revision.json`

Appendix B: 15 short-answer questions paired 1:1 with the 15 model answers, 10 essay questions,
and the "Model Comparison Outline". Each item keeps its source order.

```json
{
  "short_answer": [ { "n": 1, "question_md": "Define subject indexing.", "model_answer_md": "…", "source": "supplied", "position": 1 } ],
  "essay": [ { "n": 1, "question_md": "Discuss the objectives …", "source": "supplied", "position": 1 } ],
  "model_outline_md": "…A Model Comparison Outline text…"
}
```

## 8. Orientation (Start Here) — `content/orientation/*.md`

Static pages rendered outside the 7 modules. Frontmatter: `id`, `source`, `title`, `position`.
Files: `about-this-guide.md` (source: supplied — copyright + preface), `course-orientation.md`,
`study-guide.md`, `assessment-guide.md` (source: supplied — the 20/15/15/50 table + exam rules;
LMS-configurable defaults clearly flagged in a `## LMS defaults (not from the source)` section),
`how-to-use-the-reader.md`, `revision-checklist.md` (source: supplied — Final Revision Checklist).

## 9. Resources — `content/resources/resources.json`

Files and links shown on `/dashboard/resources`. Examination papers are seeded as
`kind: "exam_paper", visibility: "staff"` so they never reach a student: a paper is sat inside
the platform, not downloaded. A `file` stores a repository path in `storage_path` (it is served
through `/api/resources/<id>`, never from a client-supplied path); a `link` stores its `url`.

```json
{ "source": "supplied", "items": [ { "title": "…", "description": "…", "kind": "file", "visibility": "students", "source": "supplied", "storage_path": "docs/….pdf", "mime_type": "application/pdf" } ] }
```

## 10. Announcements — `content/announcements/announcements.json`

Notices on `/dashboard/announcements` and in the in-app notification list. `audience` is
`all` or `enrolled`; `status` is `published` or `draft`; `publish_at` (optional) delays a
notice until that moment. `pinned` floats a notice to the top of the page.

```json
{ "source": "lms-authored", "items": [ { "title": "…", "body_md": "…", "audience": "enrolled", "pinned": false, "status": "published" } ] }
```

## 11. Validation

Run `npm run check:content` after any edit. It fails on: missing/duplicate chapters, wrong titles,
wrong section structure, ≠5 knowledge questions, objective ≠100 / ≠4 options / key outside A–D,
theory ≠7 / marks ≠20, wrong glossary count, missing `source` labels, malformed resources or
announcements (including an examination paper that is not staff-only), and — most importantly —
question stems that fuzzy-don't match the extracted PDF text (fuzzy diff report).
