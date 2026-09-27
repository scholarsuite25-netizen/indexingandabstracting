"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Callout, Card, CardContent, CardHeader, Input, Textarea } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/roles";

type Profile = {
  fullName: string;
  institution: string;
  bio: string;
};

export function ProfileForm({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const router = useRouter();
  const supabase = getBrowserSupabase();

  const [values, setValues] = React.useState(profile);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [avatarName, setAvatarName] = React.useState<string | null>(null);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      toast.error("Account services are not configured yet.");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: values.fullName.trim(),
        institution: values.institution.trim(),
        bio: values.bio.trim(),
      })
      .eq("id", userId);
    setSavingProfile(false);

    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    toast.success("Profile saved.");
    router.refresh();
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (!supabase) {
      setPasswordError("Account services are not configured yet.");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      setPasswordError(friendlyAuthError(error.message));
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated.");
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !supabase) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    if (error) {
      setUploading(false);
      toast.error(
        error.message.toLowerCase().includes("bucket")
          ? "Avatar storage is not set up yet — it is created with the Supabase migrations (Phase 2)."
          : friendlyAuthError(error.message),
      );
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: path })
      .eq("id", userId);

    setUploading(false);

    if (updateError) {
      toast.error(friendlyAuthError(updateError.message));
      return;
    }

    setAvatarName(file.name);
    toast.success("Profile photo updated.");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-ink">Profile details</h2>
          <p className="text-sm text-ink-muted">Shown to you and to course staff.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <Input
              label="Full name"
              autoComplete="name"
              value={values.fullName}
              onChange={(event) =>
                setValues((current) => ({ ...current, fullName: event.target.value }))
              }
            />
            <Input
              label="Institution"
              autoComplete="organization"
              placeholder="e.g. University of Lagos"
              value={values.institution}
              onChange={(event) =>
                setValues((current) => ({ ...current, institution: event.target.value }))
              }
            />
            <Textarea
              label="Short bio"
              rows={3}
              placeholder="Optional — a line about your studies or work."
              value={values.bio}
              onChange={(event) =>
                setValues((current) => ({ ...current, bio: event.target.value }))
              }
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={savingProfile}>
                Save profile
              </Button>
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-ink hover:bg-canvas">
                {uploading ? "Uploading…" : avatarName ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={uploadAvatar}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="text-xs text-ink-subtle">Images up to 2 MB. Optional.</p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-ink">Change password</h2>
          <p className="text-sm text-ink-muted">You stay signed in after changing it.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="flex flex-col gap-4">
            {passwordError ? (
              <Callout tone="danger" title="Could not update password">
                {passwordError}
              </Callout>
            ) : null}
            <Input
              type="password"
              label="New password"
              autoComplete="new-password"
              hint="At least 8 characters"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setPasswordError(null);
              }}
            />
            <Input
              type="password"
              label="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setPasswordError(null);
              }}
            />
            <div>
              <Button type="submit" variant="outline" loading={savingPassword}>
                Update password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
