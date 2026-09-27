"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button, Callout, Skeleton } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/roles";

export function ClaimSuperadminButton() {
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const [checking, setChecking] = React.useState(true);
  const [exists, setExists] = React.useState<boolean | null>(null);
  const [claiming, setClaiming] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!supabase) {
        setChecking(false);
        return;
      }
      const { data, error } = await supabase.rpc("superadmin_exists");
      if (!cancelled) {
        if (!error) setExists(Boolean(data));
        setChecking(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const claim = async () => {
    if (!supabase) {
      toast.error("Account services are not configured yet.");
      return;
    }
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_first_superadmin");
    setClaiming(false);

    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }

    const result = data as { claimed: boolean; message: string };
    if (result.claimed) {
      toast.success(result.message);
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
      return;
    }

    toast.info(result.message);
    setExists(true);
  };

  if (!supabase) {
    return (
      <Callout tone="info" title="Waiting for Supabase keys">
        This page activates once your Supabase keys are in <code>.env.local</code> (Phase 2).
      </Callout>
    );
  }

  if (checking) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-56" />
      </div>
    );
  }

  if (exists) {
    return (
      <Callout tone="info" title="Already initialised">
        A superadmin already exists on this installation. Ask that account to grant you the admin
        role from its Users page — the one-time claim has been used.
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="warning" title="One-time action">
        No administrator exists yet. The first person to press this button becomes the platform
        owner (superadmin). This can only ever happen once — afterwards, admins are granted by the
        owner from the Users page.
      </Callout>
      <div>
        <Button onClick={claim} loading={claiming}>
          <ShieldCheck className="size-4" aria-hidden />
          Claim superadmin
        </Button>
      </div>
    </div>
  );
}
