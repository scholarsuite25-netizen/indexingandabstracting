import { revalidatePath } from "next/cache";
import { Scale } from "lucide-react";
import {
  Badge,
  Button,
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Assessments</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      {assessments.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-8" />}
          title="No assessments"
          description="Publish assessments to configure them."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <Table>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Title</TH>
                <TH>Pass mark</TH>
                <TH>Duration</TH>
                <TH>Max attempts</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {assessments.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <Badge variant="info">{a.type}</Badge>
                  </TD>
                  <TD>{a.title}</TD>
                  <TD>
                    <form action={handleUpdate} className="flex items-center gap-1">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="pass_mark" />
                      <Input type="number" defaultValue={a.pass_mark} name="value" className="w-16" />
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
                  <TD>
                    <form action={handleUpdate} className="flex items-center gap-1">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="duration_minutes" />
                      <Input type="number" defaultValue={a.duration_minutes ?? ""} name="value" className="w-16" />
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
                  <TD>
                    <form action={handleUpdate} className="flex items-center gap-1">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="max_attempts" />
                      <Input type="number" defaultValue={a.max_attempts} name="value" className="w-16" />
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
                  <TD>
                    <form action={handleUpdate} className="inline">
                      <input type="hidden" name="assessmentId" value={a.id} />
                      <input type="hidden" name="field" value="status" />
                      <select name="value" defaultValue={a.status} className="text-sm border rounded px-1 py-0.5">
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                      <Button variant="ghost" size="sm" type="submit">Save</Button>
                    </form>
                  </TD>
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
