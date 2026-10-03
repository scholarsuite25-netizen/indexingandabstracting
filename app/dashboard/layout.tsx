import { requireUser } from "@/lib/auth";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { LEARNER_NAV } from "@/lib/nav";
import { GuestProgressProvider } from "@/components/course/guest-progress";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/dashboard");

  if (!user.id) {
    const { cookies } = await import("next/headers");
    const guestToken = (await cookies()).get("guest_access_token")?.value;
    if (guestToken !== "granted") {
      const { redirect } = await import("next/navigation");
      redirect("/unlock");
    }
  }

  return (
    <GuestProgressProvider>
      <SidebarShell email={user.email} roleLabel="Student" nav={LEARNER_NAV}>
        {children}
      </SidebarShell>
    </GuestProgressProvider>
  );
}