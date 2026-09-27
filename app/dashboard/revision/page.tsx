import type { Metadata } from "next";
import { ListChecks } from "lucide-react";
import { Badge, Callout } from "@/components/ui";
import { RevisionCentre } from "@/components/learner/revision-centre";
import { requireUser } from "@/lib/auth";
import { getRevisionCentre } from "@/lib/data/tooling";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Revision centre" };
export const dynamic = "force-dynamic";

export default async function RevisionPage() {
  const path = "/dashboard/revision";
  await requireUser(path);

  if (!supabaseConfigured()) {
    return (
      <Callout tone="warning" title="Waiting for Supabase keys">
        Add your project URL and anon key to <code>.env.local</code> to sign in and revise.
      </Callout>
    );
  }

  const centre = getRevisionCentre();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">
            <ListChecks className="size-3" aria-hidden />
            Revision centre
          </Badge>
          <Badge variant="accent">Appendix B</Badge>
        </div>
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">
          Test yourself before the examination
        </h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          The supplied study guide&rsquo;s short-answer and essay questions, plus the final
          revision checklist. Nothing here is submitted, timed or graded - it is practice, and
          it is yours alone.
        </p>
      </header>

      <RevisionCentre centre={centre} />
    </div>
  );
}
