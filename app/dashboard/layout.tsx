import { requireUser } from "@/lib/auth";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { LEARNER_NAV } from "@/lib/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/dashboard");

  return (
    <SidebarShell email={user.email} roleLabel="Student" nav={LEARNER_NAV}>
      {children}
    </SidebarShell>
  );
}