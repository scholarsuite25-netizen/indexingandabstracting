# Known source ambiguities and discrepancies

**Policy: discrepancies are documented here, never silently fixed.**

Every time the source material is ambiguous, self-contradictory, or disagrees with what this LMS
build assumes, the ambiguity is logged in the table below and the source is treated as
authoritative (or the difference is flagged openly) — the text is never quietly "corrected".
Add rows for anything you find; **new issues are appended chronologically with the date**, so do
not rewrite or reorder existing rows.

| # | Date | Area | Issue | Resolution |
|---|---|---|---|---|
| 1 | 2026-09-25 | Glossary | Build plan assumed **53** glossary terms; source Appendix C actually contains **42** entries. | Using **42** — the source is authoritative. Validator prints a NOTE rather than a FAIL. |
| 2 | 2026-09-25 | Examination files | Exam source files are named `LIS_814_Objective_Examination.*` and `LIS_814_Theory_Examination.*`, but the paper content is headed **LIS 815: Indexing and Abstracting**. | Filenames kept as supplied (do not rename the source). The LMS displays the titles **"Objective Examination"** and **"Theory Examination"**. |
| 3 | 2026-09-25 | Theory paper / revision | Theory Q14 and Revision Q14 style mismatches (wording/structure differences between the theory paper and the revision material) are expected to surface as other agents transcribe them. | **Placeholder — new issues are appended chronologically with the date below.** Do not edit rows above; append new rows at the end of the table. |
| 4 | 2026-09-25 | PRECIS operator rules | The preface states students should follow the exact operator rules prescribed by **their own lecturer or course manual**, because notational conventions vary between institutions — the source does not fix a single notation. | Kept verbatim in `orientation/about-this-guide.md` and reflected as study advice in `orientation/study-guide.md`. The LMS **does not test exact operator notation** in its knowledge checks. |
| 5 | 2026-09-25 | LMS thresholds | Pass marks, unlock thresholds, reading threshold and attempt limits are not stated anywhere in the source material. | Declared openly in `orientation/assessment-guide.md` under `## LMS defaults (not from the source)`. |

---

## Append new issues here (chronological)

Format: `| # | YYYY-MM-DD | Area | Issue | Resolution |`

| # | Date | Area | Issue | Resolution |
|---|---|---|---|---|
| 6 | 2026-09-25 | Chapter 11 title | The table of contents lists **"Precision, Recall and Search Optimisation"** (no Oxford comma), while the chapter's own heading line reads **"Chapter 11: Precision, Recall, and Search Optimisation"** (with comma). | Kept the TOC wording in `chapter-11.md` frontmatter, per FORMAT.md ("title must match the source table of contents exactly"). Body text unchanged. |
| 7 | 2026-09-25 | Chapters 11–12 section markers | Besides the `EXAMPLE` / `WORKED EXAMPLE` / `FORMULA` markers named in FORMAT.md, the source also uses standalone **`CALCULATION`** markers (Ch. 11 §11.4, §11.6) and a **`RESULTING INFORMATIVE ABSTRACT`** marker (Ch. 12 §12.13), with no format guidance for them. | Treated like the other standalone markers: transcribed as `## CALCULATION` and `## RESULTING INFORMATIVE ABSTRACT` (map to `kind: prose`). No wording changed. |
| 8 | 2026-09-25 | Chapter 4 section marker | Ch. 4 §4.6 uses a further standalone marker variant **`EXAMPLE ENTRY`**, not named in FORMAT.md (alongside the variants logged in row 7). | Transcribed verbatim as `## EXAMPLE ENTRY` (maps to `kind: prose`). No wording changed. |
| 9 | 2026-09-25 | Chapter 2 §2.3 table | The "Index versus Table of Contents" comparison is a two-column table in the PDF, but the text extraction flattens it into alternating single lines (one wrapped cell: "Lists subjects, names, places, concepts and / keywords"), so original row/cell boundaries cannot be recovered with certainty. | Transcribed as plain consecutive lines in source order, with only the wrapped cell re-joined to one line (whitespace-only change). Words unchanged; no table markup invented. |
| 10 | 2026-09-25 | Revision Q14 / Theory Q7(b) | The questions ask the student to name **two** computer-assisted indexing software packages, but the model answers list **three** (CINDEX, Sky Index, Macrex); Theory Q7(b) hedges with "(any two)". (Clarifies the standing item in row 3.) | Kept verbatim — question and model answer both exactly as supplied; any two would be credited. |
| 11 | 2026-09-25 | Objective Q99–Q100 | BUILD_PLAN Appendix A gives these two questions no chapter (cross-cutting synthesis), so the source provides no question→chapter tag. | Editorial assignment recorded in `objective.json`: Q99 → module 3/chapter 7 (PRECIS pairing), Q100 → module 6/chapter 12 (indexing–abstracting relationship). Tags only — question text untouched. |
| 12 | 2026-09-25 | Objective Q9 / Q42 / Q86 | Q9's key is C "Mulvany (2005)" though the stem asks which "scholar defined indexing"; Q42's keyed option C reads `Nigeria — University Libraries — Artificial Intelligence`; Q86 option A reads "author surnames" (possessive apostrophe apparently dropped in the PDF). | Answer key and wording kept exactly as supplied — the paper is authoritative; we do not second-guess it. |
| 13 | 2026-09-25 | Theory paper | The paper prints **4** instruction lines (the build assumed 3), and its module labels ("Module 1 — Foundations and Types of Indexes", "Module 5 — Evaluation and System Metrics") differ from the course TOC module titles. | All 4 instructions and the printed module labels kept verbatim in `theory.json`; course module titles come from the ebook TOC. |
| 14 | 2026-09-25 | Glossary ordering | Source places **BT** before **Book index**, breaking its own alphabetical order. | Transcribed in source order (`position` 1..42), not re-alphabetised. |
| 15 | 2026-09-25 | Appendix A grouping | Appendix A mixes numbered items with preamble+sub-list blocks ("Further Indexing Practice", "Full Abstracting Exercise") — per numbered item would give 11 activities, per block gives 9. | Adopted **9 activities**: Thesaurus Construction's two numbered entries split; the two preamble+sub-list blocks stay one activity each with sub-steps intact. Flagged here rather than silently chosen. |
| 16 | 2026-09-25 | Chapters 5–8 review questions | Chapters 5, 6, 7 and 8 have only 3–4 Review Questions — fewer than the 5 knowledge-check MCQs required per chapter. | MCQs 1–4 derive from the review questions; the 5th derives from the chapter body (same topic area). All `source: lms-authored`. |
| 17 | 2026-09-25 | Extraction artefacts | PDF page furniture sometimes splits a question or paragraph (objective Q7, Q54, Q64, Q73, Q82, Q92, Q100; theory Q5(b) model answer; several chapters), and Ch. 1–2 paragraph boundaries are inferred from line-wrap geometry because the extraction has no blank lines. | Furniture stripped and halves rejoined (whitespace-only); paragraph boundaries inferred but no words changed — verified by the 100% fuzzy-diff and section-fidelity checks. |
| 18 | 2026-09-25 | Headings kept odd | Source headings "7.3 Role Operators in PRECIS", "EXAMPLE ENTRY" (ch4), "CALCULATION" (ch11), "RESULTING INFORMATIVE ABSTRACT" (ch12) read oddly or are absent from the format spec. | Kept verbatim as `##` headings; the importer maps them to safe kinds. No rewording. |

