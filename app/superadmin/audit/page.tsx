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
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Audit log</h1>
          <p className="text-sm text-ink-muted">
            Every role change and sensitive action recorded across the system.
          </p>
        </header>
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Audit log</h1>
          <p className="text-sm text-ink-muted">
            Every role change and sensitive action recorded across the system.
          </p>
          <p className="text-xs text-ink-subtle">{user.email}</p>
        </div>
      </header>

      {logs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="No audit entries"
          description="Role changes and sensitive actions are recorded here."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <Table className="min-w-[640px]">
            <THead>
              <TR>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Action</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Entity</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Actor</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">When</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((r) => (
                <TR key={r.id}>
                  <TD className="text-ink-muted">
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
