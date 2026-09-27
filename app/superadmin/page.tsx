import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  ClipboardList,
  FileText,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getSystemStats } from "@/lib/data/system";

export const metadata = { title: "System" };
export const dynamic = "force-dynamic";

function statCard(
  label: string,
  value: number | null,
  icon: React.ReactNode,
  href: string,
  note: string
) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-ink-subtle">{label}</p>
          <p className="mt-1 font-display text-2xl text-ink">
            {value !== null ? value.toLocaleString() : "—"}
          </p>
        </div>
        <div className="text-ink-subtle">{icon}</div>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-ink-muted">
        <span>{note}</span>
        <ButtonLink href={href} variant="ghost" size="sm">
          Open <ArrowRight className="size-3" />
        </ButtonLink>
      </CardContent>
    </Card>
  );
}

export default async function SuperadminPage() {
  const user = await requireRole("superadmin");
  const stats = await getSystemStats();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">System administration</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
        <Badge variant="accent">Superadmin</Badge>
      </div>

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statCard("Users", stats.users, <UserCog className="size-5" />, "/superadmin/users", "Registered learner accounts")}
          {statCard("Students", stats.students, <UserCog className="size-5" />, "/superadmin/users", "Role student")}
          {statCard("Admins", stats.admins, <UserCog className="size-5" />, "/superadmin/users", "Role admin")}
          {statCard("Superadmins", stats.superadmins, <ShieldCheck className="size-5" />, "/superadmin/users", "Role superadmin")}
          {statCard("Settings", stats.settingsCount, <BookMarked className="size-5" />, "/superadmin/settings", "Configurable course settings")}
          {statCard("Audit entries", stats.auditCount, <ClipboardList className="size-5" />, "/superadmin/audit", "Role changes and sensitive actions")}
        </div>
      ) : (
        <EmptyState
          icon={<ShieldCheck className="size-8" />}
          title="Loading system statistics"
          description="The system statistics are not available right now."
        />
      )}

      <section aria-labelledby="panels-heading" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-ink-subtle" aria-hidden />
          <h2 id="panels-heading" className="font-display text-xl text-ink">
            Panels
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/superadmin/users", label: "Users &amp; roles", desc: "Grant or revoke admin access. Every change is audited." },
            { href: "/superadmin/settings", label: "Settings", desc: "Pass marks, retake policy and certificate rules." },
            { href: "/superadmin/audit", label: "Audit log", desc: "Every role change and sensitive action." },
          ].map((p) => (
            <Card key={p.href}>
              <CardHeader>
                <CardTitle>{p.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-ink-muted">
                {p.desc}
                <ButtonLink href={p.href} variant="outline" size="sm" className="mt-3">
                  Open <ArrowRight className="size-3" />
                </ButtonLink>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <p className="text-sm text-ink-muted">
        Administrative overview:{" "}
        <Link href="/admin" className="font-medium text-primary hover:underline">
          Admin area →
        </Link>
      </p>
    </div>
  );
}
