import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <ResetPasswordForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
