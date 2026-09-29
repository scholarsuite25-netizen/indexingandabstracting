import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui";
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard/practicals"
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-primary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to practical labs
        </Link>
        <h1 className="font-display text-2xl text-ink">{activity.title}</h1>
        {activity.chapter && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <BookOpen className="size-4" aria-hidden />
            Chapter {activity.chapter.position}: {activity.chapter.title}
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Instructions</h2>
          </CardHeader>
          <CardContent>
            <Markdown source={activity.instructions_md} kind="prose" />
          </CardContent>
        </Card>

        <section className="flex flex-col gap-4">
          <PracticalWorkspace activity={activity} />
        </section>
      </div>
    </div>
  );
}
