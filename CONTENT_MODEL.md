# LIS 815 LMS - Where the course content lives and what it contains

LIS 815 LMS - the `content/` folder, the shape of each file, and the command that proves an edit is still correct.

## Two rules that override everything else

`content/FORMAT.md` states them first:

1. **Verbatim.** Text marked `source: supplied` is transcribed word for word from `docs/extracted/*.txt`. Only whitespace and formatting may change. Never reword, "improve" or silently fix the source.
2. **Label everything.** Every file carries a `source:` of `supplied` (from the PDFs), `lms-authored` (our own words), or `supplementary` (enrichment, never examinable). Anything ambiguous goes into `content/ISSUES.md` and never into a silent fix.

`DECISIONS.md` D3 records the wider decision: content is authored as files in Git first, then seeded into the database, so every change is versioned and reversible.

## What is in the folder

| Path | What it holds |
|---|---|
| `content/course.json` | course code, title and description for the one course |
| `content/core/module-01/` to `module-07/` | 14 chapter files, `chapter-01.md` to `chapter-14.md` |
| `content/assessments/knowledge/` | 14 files, `chapter-01.json` to `chapter-14.json` |
| `content/assessments/objective.json` | the 100-question objective paper with its answer key |
| `content/assessments/theory.json` | the 7-question theory paper with model answers |
| `content/glossary/glossary.json` | the glossary, transcribed from Appendix C in order |
| `content/practicals/practicals.json` | the grouped exercises from Appendix A |
| `content/revision/revision.json` | short-answer and essay questions from Appendix B, with model answers |
| `content/orientation/` | 6 static Start Here pages rendered outside the 7 modules |
| `content/resources/resources.json` | files and links for the resources page |
| `content/announcements/announcements.json` | notices for the announcements page |
| `content/FORMAT.md` | the format rules for all of the above |
| `content/ISSUES.md` | every logged ambiguity, waiting for your decision |

## Chapter files

One Markdown file per chapter, with YAML frontmatter:

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
```

The `##` headings are not decoration. The importer maps them to `lesson_sections.kind`: `## Learning Objectives` must be first, `## N.M ...` are the numbered prose sections, `## EXAMPLE`, `## WORKED EXAMPLE`, `## FORMULA` and `## Try it` become their own kinds, and `## Review Questions` must be last with at least one question. `required_reading_pct` is how much of the lesson a learner must read before it can be marked complete.

## Knowledge checks

Five multiple-choice questions per chapter, `source: lms-authored`, written from that chapter's Review Questions. Exactly four options, exactly one answer within A to D, and an explanation is required. Fourteen files times five questions is 70 questions in total, and the validator counts them.

## Objective paper

`objective.json` holds all 100 questions verbatim with the supplied key. Each question carries `source`, `source_ref`, `module` and `chapter`. The file also holds `duration_minutes` (90) and `pass_mark` (50).

## Theory paper

`theory.json` holds exactly 7 questions. Each has `parts` whose marks must sum to 20, a `total_marks` of 20, a `model_answer_md` that is staff-only until the grade is released, and `source: supplied` with a `source_ref`. The examiner's caveat ("answers are indicative rather than exhaustive") is kept on the file as `model_answer_note`, not inside the answers.

## Resources and announcements

- Resources are one of three shapes: a `file` with a `storage_path`, a `link` with a `url`, or an examination paper. Examination papers are seeded as `kind: "exam_paper"` and `visibility: "staff"` so they never reach a student; a paper is sat inside the platform, not downloaded. Files are served through `/api/resources/<id>`, never from a path the client supplies.
- Announcements have a `title`, `body_md`, an `audience` of `all` or `enrolled`, a `status` of `published` or `draft`, an optional `publish_at` to delay them, and a `pinned` flag.

## How it gets into the database

```
npm run db:seed
```

The seeder finds rows by natural key and skips ones that already exist, so running it twice never duplicates anything and never overwrites an edit you made in the admin screens. `--force` does overwrite. `--dry-run` prints the row plan and touches nothing. `--pglite` proves the whole seed against a throwaway local Postgres.

The tables it fills are listed in `DATABASE_SCHEMA.md`: `courses`, `modules`, `chapters`, `lessons`, `lesson_sections`, `question_banks`, `questions`, `question_options`, `resources`, `announcements`, `glossary_terms`, `practical_activities` and the rest.

## What validation runs

```
npm run check:content
```

`scripts/validate-content.mjs` reads the files only. It needs no keys and no database. It fails on:

- missing or duplicate chapters, a wrong title, or the wrong section structure
- knowledge checks other than 5 per chapter, or fewer than 70 in total
- objective questions other than 100, options other than A to D, an answer key outside A to D, or numbering out of order
- theory questions other than 7, sub-marks that do not sum to 20, a missing or short model answer, a missing `source_ref`
- a wrong glossary count, a wrong short-answer or essay count, or a missing model comparison outline
- a missing `source` label anywhere, or a missing or empty `content/ISSUES.md`
- malformed resources or announcements, an examination paper that is not staff-only, no resource or announcement published for students
- question stems and section openings that do not fuzzy-match the extracted PDF text in `docs/extracted/`

That last group is the source-fidelity check. If it fails, re-read `FORMAT.md` rule 1 rather than editing the extracted text.

## What to run after any content edit

```
npm run check:content
npm run db:seed
```

Then, to prove the site still behaves: `npm run test:pages` for the reading and study-tool pages, which needs a production server running (`npm run build` then `npm run start`). `TEST_PLAN.md` has the full order.

`CONTENT_EXPANSION.md` and `AI_ENRICHMENT.md` describe the enrichment and supplementary material, and `DECISIONS.md` D9 records that enrichment is stored as `source: supplementary` and labelled, never mixed into the supplied chapters.
