import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMyCertificate } from "@/lib/data/certificates";
import { requireUser } from "@/lib/auth";
import { CertificateView } from "@/components/learner/certificate-view";

export const metadata: Metadata = { title: "My Certificate" };

export default async function CertificatePage() {
  await requireUser("/dashboard/certificate");
  
  const certificate = await getMyCertificate();
  if (!certificate) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Certificate</h1>
        <div className="rounded-card border border-border bg-surface p-8 text-center">
          <p className="text-ink-muted">You have not earned a certificate yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between no-print">
        <h1 className="font-display text-2xl text-ink">My Certificate</h1>
      </div>
      
      <div className="mx-auto w-full max-w-4xl">
        <CertificateView certificate={certificate} />
      </div>
    </div>
  );
}
