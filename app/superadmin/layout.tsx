import { requireRole } from "@/lib/auth";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import {
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  GraduationCap,
  Shield,
  ArrowLeft,
} from "lucide-react";

const superadminNav = [
  { href: "/superadmin", label: "System", exact: true, icon: <LayoutDashboard className="size-4" /> },
  { href: "/superadmin/users", label: "Users", icon: <Users className="size-4" /> },
  { href: "/superadmin/settings", label: "Settings", icon: <Settings className="size-4" /> },
  { href: "/superadmin/audit", label: "Audit", icon: <FileText className="size-4" /> },
  { href: "/admin", label: "Admin", icon: <Shield className="size-4" /> },
  { href: "/dashboard", label: "Dashboard", exact: true, icon: <GraduationCap className="size-4" /> },
  { href: "/profile", label: "Profile", icon: <ArrowLeft className="size-4" /> },
];

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("superadmin");

  return (
    <SidebarShell email={user.email} roleLabel="Superadmin" nav={superadminNav}>
      {children}
    </SidebarShell>
  );
}