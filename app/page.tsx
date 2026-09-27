import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers,
  Lock,
  Search,
  Trophy,
} from "lucide-react";
import { Badge, ButtonLink, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  ASSESSMENT_FACTS,
  COURSE,
  LEARNING_OUTCOMES,
  MODULES,
} from "@/lib/course";

const features = [
  {
    icon: Lock,
    title: "Guided progression",
    body: "Lessons unlock only once the required reading and knowledge checks are genuinely complete — recorded in the database, not just on screen.",
  },
  {
    icon: Search,
    title: "Search and glossary",
    body: "Full-text search across lessons, glossary, resources and announcements, plus a searchable course glossary of key terms.",
  },
  {
    icon: FileText,
    title: "Notes and bookmarks",
    body: "Keep private notes against lessons and bookmark anything you want to return to quickly.",
  },
  {
    icon: Trophy,
    title: "Results and certificates",
    body: "Automatic marking for the objective paper, released theory results, and a verifiable certificate when you qualify.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-20">
            <div className="flex flex-col items-start gap-5">
              <Badge variant="info">
                Postgraduate course · 7 modules · 14 chapters
              </Badge>
              <h1 className="text-4xl leading-tight text-ink sm:text-5xl">
                {COURSE.code}: {COURSE.title}
              </h1>
              <p className="measure text-lg leading-relaxed text-ink-muted">
                {COURSE.tagline}. Study subject analysis and indexes,
                controlled vocabularies and thesaurus construction,
                pre-coordinate and post-coordinate systems, evaluation measures,
                abstracting, and digital and AI-assisted indexing — with
                progress that is tracked and assessments that are marked
                automatically.
              </p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/signup" size="lg">
                  Create your account
                  <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
                <ButtonLink href="/login" variant="outline" size="lg">
                  Sign in
                </ButtonLink>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 self-center">
              {[
                { value: `${ASSESSMENT_FACTS.objective.questions}`, label: "objective questions" },
                { value: `${ASSESSMENT_FACTS.objective.durationMinutes} min`, label: "objective exam" },
                { value: `${ASSESSMENT_FACTS.theory.answer} of ${ASSESSMENT_FACTS.theory.questions}`, label: "theory questions" },
                { value: `${ASSESSMENT_FACTS.objective.passMark}%`, label: "to unlock theory" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-card border border-border bg-canvas p-5"
                >
                  <p className="text-2xl font-semibold text-ink">{stat.value}</p>
                  <p className="mt-1 text-sm text-ink-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" id="outcomes">
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="text-2xl text-ink sm:text-3xl">
              What you will be able to do
            </h2>
            <p className="measure text-ink-muted">
              Learning objectives drawn from the course chapters.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LEARNING_OUTCOMES.map((outcome) => (
              <li
                key={outcome}
                className="flex gap-3 rounded-card border border-border bg-surface p-4"
              >
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-success"
                  aria-hidden
                />
                <span className="text-sm leading-relaxed text-ink-muted">
                  {outcome}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-y border-border bg-surface" id="modules">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8 flex flex-col gap-2">
              <h2 className="text-2xl text-ink sm:text-3xl">
                Course structure
              </h2>
              <p className="measure text-ink-muted">
                Seven modules containing fourteen chapters, each with core
                reading, a knowledge check and practical exercises.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {MODULES.map((module) => (
                <Card key={module.position} className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="info">Module {module.position}</Badge>
                      <span className="text-xs text-ink-subtle">
                        {module.chapters.length}{" "}
                        {module.chapters.length === 1 ? "chapter" : "chapters"}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                      {module.title}
                    </h3>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {module.summary}
                    </p>
                    <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
                      {module.chapters.map((chapter) => (
                        <li
                          key={chapter.position}
                          className="flex gap-2 text-sm text-ink"
                        >
                          <span className="font-medium text-primary">
                            Ch {chapter.position}
                          </span>
                          <span className="text-ink-muted">{chapter.title}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" id="assessment">
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="text-2xl text-ink sm:text-3xl">
              How assessment works
            </h2>
            <p className="measure text-ink-muted">
              You study in sequence, then sit the objective examination. Score
              70% or higher and the theory examination unlocks.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <ClipboardCheck className="size-6 text-primary" aria-hidden />
                <h3 className="font-display text-lg font-semibold text-ink">
                  Objective examination
                </h3>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-ink-muted">
                  <li>
                    {ASSESSMENT_FACTS.objective.questions} questions, four
                    options each, one correct answer
                  </li>
                  <li>
                    One mark per question — {ASSESSMENT_FACTS.objective.totalMarks} marks
                    total
                  </li>
                  <li>
                    Time allowed: {ASSESSMENT_FACTS.objective.durationLabel}
                  </li>
                  <li>Marked automatically the moment you submit</li>
                  <li className="font-medium text-ink">
                    {ASSESSMENT_FACTS.objective.passMark}% or higher unlocks the
                    theory examination
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileText className="size-6 text-primary" aria-hidden />
                <h3 className="font-display text-lg font-semibold text-ink">
                  Theory examination
                </h3>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-ink-muted">
                  <li>
                    {ASSESSMENT_FACTS.theory.questions} questions shown — you
                    answer exactly {ASSESSMENT_FACTS.theory.answer}
                  </li>
                  <li>
                    Each selected question carries{" "}
                    {ASSESSMENT_FACTS.theory.marksPerQuestion} marks (maximum{" "}
                    {ASSESSMENT_FACTS.theory.totalMarks})
                  </li>
                  <li>Time allowed: {ASSESSMENT_FACTS.theory.durationLabel}</li>
                  <li>Graded by your lecturer with written feedback</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BookOpenCheck className="size-6 text-primary" aria-hidden />
                <h3 className="font-display text-lg font-semibold text-ink">
                  Continuous work
                </h3>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm text-ink-muted">
                  <li>Chapter knowledge checks as you study</li>
                  <li>
                    Practical exercises: thesaurus entries, PRECIS strings,
                    KWIC/KWOC, precision and recall calculations, abstract
                    writing
                  </li>
                  <li>Revision centre before the examinations</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Assessment components and weighting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ASSESSMENT_FACTS.weights.map((item) => (
                  <div
                    key={item.component}
                    className="rounded-lg border border-border bg-canvas p-4"
                  >
                    <p className="text-xl font-semibold text-primary">
                      {item.weight}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {item.component}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {item.preparation}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink-subtle">
                Weightings are taken from the Assessment and Examination Guide
                in the supplied study guide.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <div className="mb-8 flex items-center gap-3">
              <Layers className="size-6 text-primary" aria-hidden />
              <h2 className="text-2xl text-ink sm:text-3xl">
                Built for serious study
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex gap-4 rounded-card border border-border bg-canvas p-5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <feature.icon className="size-5" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <p className="font-medium text-ink">{feature.title}</p>
                    <p className="text-sm leading-relaxed text-ink-muted">
                      {feature.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-start gap-4 rounded-card bg-primary-strong p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div className="flex flex-col gap-1">
                <p className="text-xl font-semibold">Ready to begin?</p>
                <p className="text-sm text-white/80">
                  Create an account to enrol in {COURSE.code} and start with
                  the course orientation.
                </p>
              </div>
              <ButtonLink
                href="/signup"
                size="lg"
                className="bg-white text-primary-strong hover:bg-white/90"
              >
                Create your account
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
