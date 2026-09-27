"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  const onClick = async () => {
    const supabase = getBrowserSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    toast.success("Signed out.");
    router.push("/");
    router.refresh();
  };

  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
