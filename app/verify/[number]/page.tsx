import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getPublicCertificate } from "@/lib/data/certificates";

export const metadata: Metadata = {
  title: "Verify Certificate",
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const certificate = await getPublicCertificate(number);

  if (!certificate) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col items-center justify-center bg-canvas p-6">
          <Card className="w-full max-w-md border-danger-soft">
            <CardHeader className="flex flex-col items-center text-center">
              <XCircle className="size-12 text-danger mb-4" />
              <CardTitle className="text-xl">Certificate Not Found</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-ink-muted">
              <p>
                We could not find a certificate matching the number{" "}
                <strong className="text-ink">{number}</strong>.
              </p>
              <p className="mt-2">
                Please double-check the URL or the certificate number and try again.
              </p>
            </CardContent>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isRevoked = certificate.status === "revoked";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center bg-canvas p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-col items-center text-center">
            {isRevoked ? (
              <ShieldAlert className="size-12 text-danger mb-4" />
            ) : (
              <CheckCircle2 className="size-12 text-success mb-4" />
            )}
            <CardTitle className="text-xl">
              {isRevoked ? "Certificate Revoked" : "Certificate Verified"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col items-center text-center border-b border-border pb-4">
              <p className="text-sm text-ink-muted">Awarded to</p>
              <p className="text-lg font-semibold text-ink">{certificate.studentName}</p>
              {certificate.studentInstitution && (
                <p className="text-sm text-ink-subtle">{certificate.studentInstitution}</p>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between gap-4">
                <span className="text-sm text-ink-muted">Course</span>
                <span className="text-sm font-medium text-ink text-right">
                  {certificate.courseCode}: {certificate.courseTitle}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-sm text-ink-muted">Date of Issue</span>
                <span className="text-sm font-medium text-ink">
                  {new Date(certificate.issuedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-sm text-ink-muted">Certificate No.</span>
                <span className="text-sm font-medium text-ink font-mono">{certificate.number}</span>
              </div>
            </div>

            {isRevoked && (
              <div className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
                <strong>Status: Revoked.</strong> {certificate.revokedReason}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
