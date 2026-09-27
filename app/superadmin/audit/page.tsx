import { ClipboardList } from "lucide-react";
import {
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getAuditLogs } from "@/lib/data/system";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireRole("superadmin");

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Audit log</h1>
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="Waiting for Supabase keys"
          description="Add the project URL and anon key to .env.local to continue."
        />
      </div>
    );
  }

  const logs = await getAuditLogs();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Audit log</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="No audit entries"
          description="Role changes and sensitive actions are recorded here."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <Table>
            <THead>
              <TR>
                <TH>Action</TH>
                <TH>Entity</TH>
                <TH>Actor</TH>
                <TH>When</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <code className="text-sm text-ink">{r.action}</code>
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {r.entity_type ?? ""}
                    {r.entity_id ? ` ${r.entity_id}` : ""}
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {r.actor_email ?? "—"}
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}
    </div>
  );
}
