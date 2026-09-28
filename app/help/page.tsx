import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ASSESSMENT_FACTS } from "@/lib/course";

export const metadata: Metadata = { title: "Help" };

const faqs = [
  {
    q: "How does the course work?",
    a: "You move through the course in sequence. Each chapter gives you core reading and a knowledge check. The next lesson opens only after the current one is genuinely completed — the reading requirement and any required knowledge check are checked by the system, not just by a button on screen.",
  },
  {
    q: "What is the objective examination?",
    a: `It contains ${ASSESSMENT_FACTS.objective.questions} multiple-choice questions with four options each, one correct answer per question, and one mark per question. Time allowed is ${ASSESSMENT_FACTS.objective.durationLabel}. It is marked automatically as soon as you submit.`,
  },
  {
    q: "What mark do I need before the theory examination?",
    a: `At least ${ASSESSMENT_FACTS.objective.passMark}%. Below that score you will see which chapters to revise and you can retake the objective paper according to the course's retake policy.`,
  },
  {
    q: "How does the theory examination work?",
    a: `You are shown ${ASSESSMENT_FACTS.theory.questions} questions and must answer exactly ${ASSESSMENT_FACTS.theory.answer}. Each selected question is worth ${ASSESSMENT_FACTS.theory.marksPerQuestion} marks, giving a maximum of ${ASSESSMENT_FACTS.theory.totalMarks}. Time allowed is ${ASSESSMENT_FACTS.theory.durationLabel}. Your lecturer reads and marks each answer and gives feedback.`,
  },
  {
    q: "What are Supplementary Enrichment materials?",
    a: "Some units go beyond the supplied LIS LMS study guide — for example metadata, authority control, full-text indexing and AI literacy. They are always marked with a 'Supplementary Enrichment' label, are never presented as part of the original course text, and are not examined.",
  },
  {
    q: "Can I study on my phone?",
    a: "Yes. The reader, examinations and dashboards are designed for small screens and slow connections. Your progress is saved continuously, so you can stop and continue later.",
  },
  {
    q: "Are my notes and bookmarks private?",
    a: "Yes. Notes, bookmarks and results are visible only to you. Course staff can see your progress and grades for academic purposes.",
  },
  {
    q: "When do I receive a certificate?",
    a: "When you meet the course completion conditions — required lessons finished, objective examination passed, and the theory examination graded and released. Your dashboard always shows exactly what is still outstanding.",
  },
  {
    q: "Who do I contact if something is wrong?",
    a: "Use your lecturer's official course communication channel for academic questions, and the system administrator for account or technical problems.",
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl text-ink">Help</h1>
          <p className="measure text-ink-muted">
            Answers to the questions students ask most often about this course
            and platform.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq) => (
            <Card key={faq.q}>
              <CardHeader>
                <CardTitle>{faq.q}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-ink-muted">{faq.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
