import { requireUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const supabase = await createServerSupabase();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("full_name, institution, bio, avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl text-ink">Profile &amp; account</h1>
        <p className="text-sm text-ink-muted">{user.email}</p>
      </header>

      <ProfileForm
        userId={user.id}
        profile={{
          fullName: data?.full_name ?? "",
          institution: data?.institution ?? "",
          bio: data?.bio ?? "",
        }}
      />
    </div>
  );
}
