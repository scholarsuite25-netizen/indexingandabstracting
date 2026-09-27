import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

const superadminNav = [
  { href: "/superadmin", label: "System", exact: true },
  { href: "/superadmin/users", label: "Users" },
  { href: "/superadmin/settings", label: "Settings" },
  { href: "/superadmin/audit", label: "Audit" },
  { href: "/admin", label: "Admin" },
  { href: "/profile", label: "Profile" },
];

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("superadmin");

  return (
    <AppShell email={user.email} roleLabel="Superadmin" nav={superadminNav}>
      {children}
    </AppShell>
  );
}
