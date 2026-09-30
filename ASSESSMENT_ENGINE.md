# LIS 815 LMS - How examinations are marked and released

LIS 815 LMS - the objective paper, the 70% gate, the theory paper, the grade states and the certificate, with the file each rule lives in.

## The source rules

`ASSESSMENT_RULES.md` is the authority. It says:

- The objective paper is 100 questions, four options A to D, one correct answer, one mark each, recommended duration 90 minutes, marked automatically on submission.
- A learner must score at least 70% in the required objective assessment to unlock the theory examination, and the gate is enforced server-side. The screen should show Locked, Eligible, Submitted, Passed or Needs Retry.
- The theory paper presents 7 questions; the learner answers exactly 5; each selected answer carries 20 marks; the maximum is 100; a lecturer or admin marks them.
- Randomisation is configurable, never hard-coded. The supplied papers stay as the reference set.

## The objective paper

- The questions live in `content/assessments/objective.json` and are loaded by `npm run db:seed`.
- A learner starts an attempt with `start_objective_attempt()` and saves answers with `save_answer()`, both in `supabase/migrations/0007_assessment_engine.sql`.
- `save_answer()` keeps `is_correct` server-side. The learner can never write it: the `protect_attempt_answers` trigger in `0003_rls.sql` refuses the write, and the RLS policy on `question_options` hides the answer key from students entirely (`SECURITY.md`).
- One function, `mark_attempt_internal()`, marks an attempt from the saved answers. `0007_assessment_engine.sql` describes it as "one place that marks an attempt".
- Submitting marks whatever was saved, including an attempt that ran out of time. `get_attempt_results()` still returns the score for a timed-out attempt.
- Answers reveal the correct option only after marking. Before that, nothing is handed out.

## The 70% gate

- The threshold is a setting, not a hard-coded number: `theory_unlock_score`, seeded at `70` in `0004_seed_settings.sql` and labelled an LMS default.
- `theory_eligibility()` in `0007_assessment_engine.sql` answers for any learner or staff member. It returns a state of `not_enrolled`, `not_attempted`, `eligible` or `below_threshold`, plus the threshold, the best percentage, the attempt count and a plain-English reason such as "The theory examination opens at 70 percent on the objective assessment. Your best score is 62 percent."
- The gate is checked in the UI, in a database function, in a constraint or trigger, and in an RLS policy. `DECISIONS.md` D6 records that belt-and-braces choice.

## The theory paper

- Seven questions live in `content/assessments/theory.json`, each with sub-parts that must sum to 20 marks and a `model_answer_md` that is staff-only until release (`DECISIONS.md` D5).
- `select_theory_questions()` accepts exactly five. `verify-theory.mjs` proves that four and six are both refused.
- `enforce_theory_submission_rules()` in `0008_theory_exam.sql` is a trigger on `theory_submissions`, so the rule holds however the row is written: a submitted paper must answer exactly 5 questions and must not contain an empty answer. It also records `selected_question_ids`, `submitted_at` and `total_words`. A paper closed by the clock is allowed through.
- `get_theory_workspace()` returns the learner's own view and never a model answer. `get_theory_grading_view()` returns model answers, behind the grade permission.
- The pass mark is a setting: `theory_pass_mark`, seeded at `50` in `0004_seed_settings.sql` and labelled "LMS default, not from source". `DECISIONS.md` D10 explains why: the supplied papers do not state a pass mark, so inventing one would be academically wrong.

## Grade states

A theory paper moves through five states, enforced by a check constraint in `0001_schema.sql` and by `claim_theory_submission()` in `0008_theory_exam.sql`:

```
draft -> submitted -> under_review -> graded -> released
```

- `draft`: the learner is still writing. Answers can still change.
- `submitted`: the paper is closed. The trigger has filled the totals.
- `under_review`: a marker has picked it up from the queue.
- `graded`: every answer carries a mark and the total is written.
- `released`: the learner may now see the mark and the feedback.

Migration `0010_released_marks_only.sql` exists because a running total used to be published after the first answer was marked, which handed a half-marked score to the learner days early. Now the total is written only once every answer has a mark, and a row holding an unreleased mark cannot be selected by the learner at all.

`theory_grades` rows are readable by the learner only when the submission status is `released`; that rule is a policy in `0003_rls.sql`.

## Certificates

- `certificate_eligible()` in `0013_certificate_publicity.sql` returns a plain JSON answer: `eligible`, plus counts for lessons, objective, theory and practicals, each with its pass mark.
- It requires every required published lesson completed, the best objective percentage at or above `objective_pass_mark` (seeded at `50`), a released or graded theory score at or above `theory_pass_mark` (seeded at `50`), and, if `require_practicals` is on, every required practical graded at or above `practical_pass_mark`. That last half was added in `0013`; it is off by default.
- Note the two different numbers: `theory_unlock_score` (70) opens the theory paper; `objective_pass_mark` (50) is the certificate threshold. Both are settings an admin can change.
- Auto-issue: when a theory grade is released and the setting `auto_issue_certificates` is true, the release function tries to issue a certificate. Failure is logged to the audit table rather than breaking the release.
- Revocation: `revoke_certificate()` is admin-only, requires a reason of at least 3 characters, and writes an audit line.
- Verification: `get_public_certificate()` is granted to `authenticated` only (since `0014_verify_requires_login.sql`), and `/verify/[number]` sends signed-out visitors to `/login` first — verification is a signed-in feature. It returns only the number, dates, status, revocation reason, course title, learner name and institution. It is rate-limited to **30 lookups a minute per caller address** using the `rate_limits` table, and every lookup is audited, whether it found a match or not.

## Where each layer sits

| Layer | What it does here |
|---|---|
| Screen | shows Locked / Eligible / Submitted / Passed / Needs Retry, and refuses buttons |
| Database function | marks attempts, applies the 70% gate, accepts exactly five answers, issues certificates |
| Trigger | the exactly-5 rule, and the guards that stop learners writing `is_correct`, scores or statuses |
| RLS policy | hides question options, model answers and unreleased grades from learners |

`DECISIONS.md` D6 says one layer is convenience and the rest are security.

## What to run to prove it

```
npm run test:assessment
npm run test:theory
npm run check:sql
npm run test:rls
```

`test:assessment` walks the objective paper: starting before the required lessons is refused, answers save and replace, a learner cannot set `is_correct`, a timed-out attempt still reports, and scores either side of the threshold flip the gate. `test:theory` walks one paper end to end: four and six refused, five accepted, no model answer in the workspace, autosave with a word count, grading and release. Both need the three Supabase keys in `.env.local`. See `TEST_PLAN.md`.
