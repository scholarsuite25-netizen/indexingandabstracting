import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import { LEARNER_NAV } from "@/lib/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/dashboard");

  return (
    <AppShell email={user.email} roleLabel="Student" nav={LEARNER_NAV}>
      {children}
    </AppShell>
  );
}
