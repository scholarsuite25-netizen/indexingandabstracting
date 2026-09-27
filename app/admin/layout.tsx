import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

const adminNav = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/theory", label: "Theory marking" },
  { href: "/admin/learners", label: "Learners" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/assessments", label: "Assessments" },
  { href: "/profile", label: "Profile" },
  { href: "/help", label: "Help" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin", "superadmin");

  return (
    <AppShell email={user.email} roleLabel="Admin" nav={adminNav}>
      {children}
    </AppShell>
  );
}
