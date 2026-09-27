import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">
        <AuthForm mode="login" />
      </main>
      <SiteFooter />
    </>
  );
}
