import { revalidatePath } from "next/cache";
import { Settings } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/server";
import { getSettings, updateSetting } from "@/lib/data/system";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

async function handleUpdate(formData: FormData) {
  "use server";
  const key = formData.get("key") as string;
  const value = formData.get("value") as string;
  await updateSetting(key, value);
  revalidatePath("/superadmin/settings");
}

export default async function SettingsPage() {
  const user = await requireRole("superadmin");

  if (!supabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl text-ink">Settings</h1>
        <EmptyState
          icon={<Settings className="size-8" />}
          title="Waiting for Supabase keys"
          description="Add the project URL and anon key to .env.local to continue."
        />
      </div>
    );
  }

  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Settings</h1>
          <p className="text-sm text-ink-muted">{user.email}</p>
        </div>
      </div>

      {settings.length === 0 ? (
        <EmptyState
          icon={<Settings className="size-8" />}
          title="No settings found"
          description="Course settings are not configured yet."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <Table>
            <THead>
              <TR>
                <TH>Setting</TH>
                <TH>Value</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {settings
                .filter((s) => !s.is_secret)
                .map((s) => (
                  <TR key={s.key}>
                    <TD>
                      <code className="text-sm text-ink">{s.key}</code>
                      <p className="text-xs text-ink-muted">{s.description ?? ""}</p>
                    </TD>
                    <td>
                      <form action={handleUpdate} className="flex gap-2">
                        <input type="hidden" name="key" value={s.key} />
                        <Input
                          name="value"
                          defaultValue={String(s.value ?? "")}
                          className="w-48"
                        />
                        <Button variant="primary" size="sm" type="submit">
                          Save
                        </Button>
                      </form>
                    </td>
                  </TR>
                ))}
            </TBody>
          </Table>
          <Callout tone="warning" title="Secret settings are hidden">
            Settings marked as secret are not shown here and can only be edited
            through the database.
          </Callout>
        </section>
      )}
    </div>
  );
}
