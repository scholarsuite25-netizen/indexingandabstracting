import { Metadata } from "next";
import { BookOpenCheck, ArrowRight } from "lucide-react";
import { Badge, ButtonLink, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import { getPracticalActivities } from "@/lib/data/practicals";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Practical Labs" };

export default async function PracticalsPage() {
  await requireUser("/dashboard/practicals");
  const activities = await getPracticalActivities();

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Practical Labs</h1>
        <EmptyState
          icon={<BookOpenCheck className="size-8" />}
          title="No practical activities found"
          description="Check back later for hands-on exercises."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-ink">Practical Labs</h1>
        <p className="text-ink-muted">
          Hands-on exercises from Appendix A to apply what you've learned.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((activity: any) => (
          <Card key={activity.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start gap-2">
                <Badge variant={activity.is_required ? "warning" : "neutral"}>
                  {activity.is_required ? "Required" : "Optional"}
                </Badge>
                {activity.chapter && (
                  <span className="text-xs text-ink-subtle">
                    Ch {activity.chapter.position}
                  </span>
                )}
              </div>
              <CardTitle className="mt-2 text-lg">{activity.title}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto pt-4 border-t border-border">
              <ButtonLink
                href={`/dashboard/practicals/${activity.id}`}
                variant="outline"
                className="w-full justify-between"
              >
                Open workspace
                <ArrowRight className="size-4" />
              </ButtonLink>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
