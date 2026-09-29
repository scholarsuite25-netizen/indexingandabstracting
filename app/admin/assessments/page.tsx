import { revalidatePath } from "next/cache";
import { Scale } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getAssessmentCentre } from "@/lib/data/assessments";

export const metadata = { title: "Assessments" };
export const dynamic = "force-dynamic";

async function handleUpdate(formData: FormData) {
  "use server";
  const id = formData.get("assessmentId") as string;
  const field = formData.get("field") as string;
  const value = formData.get("value") as string;
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const sb = await createServerSupabase();
  if (sb) {
    const patch: Record<string, unknown> = {};
    if (field === "pass_mark") patch.pass_mark = Number(value);
    if (field === "duration_minutes") patch.duration_minutes = Number(value);
    if (field === "max_attempts") patch.max_attempts = Number(value);
    if (field === "status") patch.status = value;
    if (Object.keys(patch).length > 0) {
      await sb.from("assessments").update(patch).eq("id", id);
    }
  }
  revalidatePath("/admin/assessments");
}

export default async function AssessmentsPage() {
  const user = await requireRole("admin", "superadmin");
  const centre = await getAssessmentCentre();
  const assessments = centre?.assessments ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Assessments</h1>
          <p className="text-sm text-ink-muted">
            Pass marks, durations and retake limits for every published assessment.
          </p>
          <p className="text-xs text-ink-subtle">{user.email}</p>
        </div>
      </header>

      {assessments.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-8" />}
          title="No assessments"
          description="Publish assessments to configure them."
          action={
            <ButtonLink href="/admin" variant="primary" size="sm">
              Back to dashboard
            </ButtonLink>
          }
        />
      ) : (
        <section className="flex flex-col gap-4">
          <Table className="min-w-[640px]">
            <THead>
              <TR>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Type</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Title</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Pass mark</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Duration</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Max attempts</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Status</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle" />
              </TR>
            </THead>
            <TBody>
              {assessments.map((a) => (
                <TR key={a.id}>
                  <TD className="text-ink-muted">
                    <Badge variant="info">{a.type.replace(/_/g, " ")}</Badge>
                  </TD>
                  <TD className="text-ink-muted">
                    <span className="font-medium text-ink">{a.title}</span>
                  </TD>
                  <TD className="text-ink-muted">
                    <form action={handleUpdate} className="flex items-center gap-1">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="pass_mark" />
                      <Input type="number" defaultValue={a.pass_mark} name="value" className="w-16" />
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
                  <TD className="text-ink-muted">
                    <form action={handleUpdate} className="flex items-center gap-1">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="duration_minutes" />
                      <Input type="number" defaultValue={a.duration_minutes ?? ""} name="value" className="w-16" />
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
                  <TD className="text-ink-muted">
                    <form action={handleUpdate} className="flex items-center gap-1">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="max_attempts" />
                      <Input type="number" defaultValue={a.max_attempts ?? ""} name="value" className="w-16" />
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
                  <TD />
                  <TD />
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}
    </div>
  );
}
