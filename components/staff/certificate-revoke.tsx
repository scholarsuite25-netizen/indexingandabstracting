"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Label } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Revocation runs through the revoke_certificate SECURITY DEFINER function rather than
 * a direct update: the function checks the caller is an administrator, requires a
 * reason, refuses to revoke twice, and writes the audit line. The RLS policy on
 * certificates_update would allow an admin to flip the column directly, which is why
 * the function exists — a revocation nobody can trace is worth less than one they can.
 */
export function CertificateRevoke({
  id,
  number,
  status,
  reason,
}: {
  id: string;
  number: string;
  status: string;
  reason?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  if (status === "revoked") {
    return (
      <span className="text-sm text-ink-muted">
        Revoked{reason ? ` — ${reason}` : ""}
      </span>
    );
  }

  async function confirm() {
    const text = value.trim();
    if (text.length < 3) {
      toast.error("Give a reason of at least 3 characters.");
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    setSaving(true);
    const { error } = await supabase.rpc("revoke_certificate", {
      p_certificate_id: id,
      p_reason: text,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || "Could not revoke this certificate.");
      return;
    }

    toast.success(`${number} revoked.`);
    setOpen(false);
    setValue("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Revoke
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`revoke-${id}`}>Reason (shown on the public verification page)</Label>
      <Input
        id={`revoke-${id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Issued in error"
        autoFocus
      />
      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={confirm} loading={saving}>
          Confirm revoke
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
