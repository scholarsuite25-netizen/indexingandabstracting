import { Metadata } from "next";
import { Award, CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { getCertificateStatus } from "@/lib/data/certificates";
import type { CertificateRequirements } from "@/lib/data/learner";
import { requireUser } from "@/lib/auth";
import { CertificateView } from "@/components/learner/certificate-view";

export const metadata: Metadata = { title: "My Certificate" };

type Requirement = { label: string; detail: string; met: boolean };

/**
 * The eligibility RPC has always returned this breakdown per criterion; until now the
 * page showed one fixed sentence instead, so a learner who had finished everything but
 * the objective paper was told to "finish the required lessons, pass the objective
 * assessment and have the theory graded" with no way to tell which of those was left.
 */
function outstanding(r: CertificateRequirements | null): Requirement[] {
  const pct = (n?: number) => `${Math.round(Number(n ?? 0))}%`;
  const lessons = r?.lessons ?? {};
  const objective = r?.objective ?? {};
  const theory = r?.theory ?? {};
  const practicals = r?.practicals ?? {};
  const lessonsMet = (lessons.total ?? 0) > 0 && (lessons.done ?? 0) >= (lessons.total ?? 0);
  const objectiveMet = Number(objective.best ?? 0) >= Number(objective.pass_mark ?? 0);
  const theoryMet = Number(theory.best ?? 0) >= Number(theory.pass_mark ?? 0);
  const practicalsMet =
    !practicals.required ||
    (practicals.total ?? 0) === 0 ||
    (practicals.done ?? 0) >= (practicals.total ?? 0);

  return [
    {
      label: "Required lessons",
      detail: `${lessons.done ?? 0} of ${lessons.total ?? 0} complete`,
      met: lessonsMet,
    },
    {
      label: "Objective assessment",
      detail: `Best ${pct(objective.best)} — pass mark ${pct(objective.pass_mark)}`,
      met: objectiveMet,
    },
    {
      label: "Theory examination",
      detail:
        Number(theory.best ?? 0) > 0
          ? `Best ${pct(theory.best)} — pass mark ${pct(theory.pass_mark)}`
          : `Not yet taken — pass mark ${pct(theory.pass_mark)}`,
      met: theoryMet,
    },
    ...(practicals.required && (practicals.total ?? 0) > 0
      ? [
          {
            label: "Required practical activities",
            detail: `${practicals.done ?? 0} of ${practicals.total ?? 0} graded at ${practicals.pass_mark ?? 8} out of 10 or above`,
            met: practicalsMet,
          },
        ]
      : []),
  ];
}

export default async function CertificatePage() {
  await requireUser("/dashboard/certificate");

  const { certificate, requirements } = await getCertificateStatus();

  if (!certificate) {
    const items = outstanding(requirements);

    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-2xl text-ink">Certificate</h1>
          <p className="text-sm text-ink-muted">
            Your certificate of completion for this course, ready to print or save as a PDF.
          </p>
        </header>

        <EmptyState
          icon={<Award className="size-8" />}
          title="You have not earned a certificate yet"
          description="Your certificate is issued the moment every requirement below is met."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What is still outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  {item.met ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  )}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-ink">
                      {item.label}
                      <span className="sr-only">{item.met ? " — complete" : " — outstanding"}</span>
                    </span>
                    <span className="text-sm text-ink-muted">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 no-print">
        <h1 className="font-display text-2xl text-ink">My Certificate</h1>
        <p className="text-sm text-ink-muted">
          Your certificate of completion for this course, ready to print or save as a PDF.
        </p>
      </header>

      <div className="mx-auto w-full max-w-4xl">
        <CertificateView certificate={certificate} />
      </div>
    </div>
  );
}
