import Link from "next/link";
import { UserPlus, UserX, UserCog } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { listUsers, grantRole, revokeRole } from "@/lib/data/system";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

export const metadata = { title: "Users & roles" };
export const dynamic = "force-dynamic";

async function handleGrant(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const role = formData.get("role") as string;
  await grantRole(userId, role);
  revalidatePath("/superadmin/users");
}

async function handleRevoke(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const role = formData.get("role") as string;
  await revokeRole(userId, role);
  revalidatePath("/superadmin/users");
}

export default async function UsersPage() {
  const user = await requireRole("superadmin");

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Users &amp; roles</h1>
          <p className="text-sm text-ink-muted">
            Grant or revoke admin access. Every change is audited.
          </p>
        </header>
        <EmptyState
          icon={<UserCog className="size-8" />}
          title="Waiting for Supabase keys"
          description="Add the project URL and anon key to .env.local to continue."
        />
      </div>
    );
  }

  const users = await listUsers();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">Users &amp; roles</h1>
          <p className="text-sm text-ink-muted">
            Grant or revoke admin access. Every change is audited.
          </p>
          <p className="text-xs text-ink-subtle">{user.email}</p>
        </div>
      </header>

      {users.length === 0 ? (
        <EmptyState
          icon={<UserCog className="size-8" />}
          title="No users yet"
          description="Learner accounts appear here when they sign up."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <Table className="min-w-[640px]">
            <THead>
              <TR>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Name</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Email</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Role</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">Member since</TH>
                <TH className="text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {users.map((r) => (
                <TR key={r.id}>
                  <TD className="text-ink-muted">
                    <span className="font-medium text-ink">{r.full_name}</span>
                  </TD>
                  <TD className="tabular-nums text-ink-muted">{r.email}</TD>
                  <TD className="text-ink-muted">
                    <Badge variant={r.role === "superadmin" ? "accent" : r.role === "admin" ? "info" : "neutral"}>
                      {r.role}
                    </Badge>
                  </TD>
                  <TD className="tabular-nums text-ink-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TD>
                  <TD className="text-ink-muted">
                    {r.role === "student" ? (
                      <form action={handleGrant} className="inline">
                        <input type="hidden" name="userId" value={r.id} />
                        <input type="hidden" name="role" value="admin" />
                        <Button variant="ghost" size="sm" type="submit">
                          <UserPlus className="size-3" /> Grant admin
                        </Button>
                      </form>
                    ) : (
                      <form action={handleRevoke} className="inline">
                        <input type="hidden" name="userId" value={r.id} />
                        <input type="hidden" name="role" value={r.role} />
                        <Button variant="ghost" size="sm" type="submit">
                          <UserX className="size-3" /> Revoke {r.role}
                        </Button>
                      </form>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}
    </div>
  );
}
