import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">
        <div className="mx-auto w-full max-w-md px-4 py-10">
          <ForgotPasswordForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
