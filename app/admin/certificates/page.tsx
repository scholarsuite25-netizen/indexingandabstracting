import type { Metadata } from "next";
import { Award } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CertificateRevoke } from "@/components/staff/certificate-revoke";

export const metadata: Metadata = { title: "Certificates" };

type CertificateRow = {
  id: string;
  certificate_number: string;
  issued_at: string;
  status: string;
  revoked_reason: string | null;
  course: { code: string; title: string } | null;
  learner: { full_name: string; email: string } | null;
};

export default async function AdminCertificatesPage() {
  await requireRole("admin", "superadmin");

  const supabase = await createServerSupabase();
  const { data, error } = supabase
    ? await supabase
        .from("certificates")
        .select(`
          id,
          certificate_number,
          issued_at,
          status,
          revoked_reason,
          course:courses(code, title),
          learner:profiles(full_name, email)
        `)
        .order("issued_at", { ascending: false })
        .limit(200)
    : { data: null, error: null };

  if (error) {
    console.error("admin certificates failed:", error.message);
  }

  const rows = (data ?? []) as unknown as CertificateRow[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl text-ink">Certificates</h1>
        <p className="text-sm text-ink-muted">
          Every certificate this course has issued. Revoking takes effect immediately on the
          public verification page and cannot be undone — issue a new one if it was withdrawn in
          error.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Award className="size-8" />}
          title="No certificates issued yet"
          description="Certificates appear here as soon as a learner meets every requirement, or when a theory grade is released with automatic issuance switched on."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issued ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Learner</TH>
                  <TH>Certificate No.</TH>
                  <TH>Course</TH>
                  <TH>Issued</TH>
                  <TH>Status</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <div className="flex flex-col">
                        <span className="font-medium text-ink">
                          {row.learner?.full_name || "Unnamed learner"}
                        </span>
                        <span className="text-xs text-ink-subtle">{row.learner?.email}</span>
                      </div>
                    </TD>
                    <TD className="font-mono">{row.certificate_number}</TD>
                    <TD>{row.course?.code}</TD>
                    <TD>{new Date(row.issued_at).toLocaleDateString()}</TD>
                    <TD>
                      <Badge variant={row.status === "revoked" ? "danger" : "success"}>
                        {row.status === "revoked" ? "Revoked" : "Issued"}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <CertificateRevoke
                        id={row.id}
                        number={row.certificate_number}
                        status={row.status}
                        reason={row.revoked_reason}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
