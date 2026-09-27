import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { Markdown } from "@/components/course/markdown";
import { PracticalWorkspace } from "@/components/learner/practical-workspace";
import { getPracticalActivity } from "@/lib/data/practicals";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Practical Workspace" };

export default async function PracticalActivityPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  await requireUser(`/dashboard/practicals/${activityId}`);

  const activity = await getPracticalActivity(activityId);

  if (!activity) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <ButtonLink href="/dashboard/practicals" variant="ghost" className="px-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 size-4" />
            Back to Practicals
          </ButtonLink>
        </div>
        <h1 className="font-display text-3xl text-ink">{activity.title}</h1>
        {activity.chapter && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <BookOpen className="size-4" />
            Chapter {activity.chapter.position}: {activity.chapter.title}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-sm">
          <h2 className="font-display text-xl text-ink">Instructions</h2>
          <div className="prose prose-sm prose-slate max-w-none text-ink-muted">
            <Markdown source={activity.instructions_md} kind="prose" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <PracticalWorkspace activity={activity} />
        </section>
      </div>
    </div>
  );
}
