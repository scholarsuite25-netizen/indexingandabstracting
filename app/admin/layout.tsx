import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  FolderOpen,
  HelpCircle,
  Settings,
  MessageSquare,
} from "lucide-react";

const adminNav = [
  { href: "/admin", label: "Overview", exact: true, icon: <LayoutDashboard className="size-4" /> },
  { href: "/admin/theory", label: "Theory marking", icon: <FileText className="size-4" /> },
  { href: "/admin/learners", label: "Learners", icon: <Users className="size-4" /> },
  { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="size-4" /> },
  { href: "/admin/content", label: "Content", icon: <FolderOpen className="size-4" /> },
  { href: "/admin/questions", label: "Questions", icon: <MessageSquare className="size-4" /> },
  { href: "/admin/assessments", label: "Assessments", icon: <Settings className="size-4" /> },
  { href: "/profile", label: "Profile", icon: <Users className="size-4" /> },
  { href: "/help", label: "Help", icon: <HelpCircle className="size-4" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin", "superadmin");

  return (
    <AppShell email={user.email} roleLabel="Admin" nav={adminNav}>
      {children}
    </AppShell>
  );
}
