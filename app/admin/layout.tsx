import { requireRole } from "@/lib/auth";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Settings,
  MessageSquare,
  Award,
  Library,
} from "lucide-react";

const adminNav = [
  { href: "/admin", label: "Overview", exact: true, icon: <LayoutDashboard className="size-4" /> },
  { href: "/admin/theory", label: "Theory marking", icon: <FileText className="size-4" /> },
  { href: "/admin/learners", label: "Learners", icon: <Users className="size-4" /> },
  { href: "/admin/certificates", label: "Certificates", icon: <Award className="size-4" /> },
  { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="size-4" /> },
  { href: "/admin/content", label: "Content", icon: <FolderOpen className="size-4" /> },
  { href: "/admin/resources", label: "Resources", icon: <Library className="size-4" /> },
  { href: "/admin/questions", label: "Questions", icon: <MessageSquare className="size-4" /> },
  { href: "/admin/assessments", label: "Assessments", icon: <Settings className="size-4" /> },
  { href: "/dashboard", label: "Dashboard", exact: true, icon: <GraduationCap className="size-4" /> },
  { href: "/profile", label: "Profile", icon: <Users className="size-4" /> },
  { href: "/help", label: "Help", icon: <HelpCircle className="size-4" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin", "superadmin");

  return (
    <SidebarShell email={user.email} roleLabel="Admin" nav={adminNav}>
      {children}
    </SidebarShell>
  );
}