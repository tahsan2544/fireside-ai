import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updateDisplayName } from "@/lib/hearth.functions";
import { AppShell, useMe } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Fireside AI" },
      { name: "description", content: "Update the name others see by the fire, or step outside." },
      { property: "og:title", content: "Settings — Fireside AI" },
      { property: "og:description", content: "Update the name others see by the fire, or step outside." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const updateFn = useServerFn(updateDisplayName);
  const [name, setName] = useState("");

  useEffect(() => {
    if (me.data?.displayName) setName(me.data.displayName);
  }, [me.data?.displayName]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { displayName: name.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="serif text-2xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Small things, quietly kept.</p>

        <div className="mt-10 space-y-6">
          <div>
            <Label htmlFor="display" className="text-xs text-muted-foreground">Display name</Label>
            {me.isLoading ? (
              <Skeleton className="mt-2 h-9 w-full" />
            ) : (
              <Input id="display" value={name} onChange={(e) => setName(e.target.value)} className="mt-2" maxLength={40} />
            )}
            <p className="mt-2 text-xs text-muted-foreground">{me.data?.email}</p>
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name.trim() || name.trim() === me.data?.displayName}
            className="w-full rounded-full"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>

          <Button onClick={signOut} variant="outline" className="w-full rounded-full">
            <LogOut className="mr-2 h-4 w-4" /> Log Out
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
