import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPrefs, updatePrefs, getUsageSummary } from "@/lib/fireside.functions";
import { AppShell } from "@/components/AppShell";
import { AI_VOICES } from "@/lib/voices";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { DISCLAIMER } from "@/lib/safety";
import { toast } from "sonner";
import { Loader2, LogOut, Brain, NotebookPen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Fireside AI" },
      {
        name: "description",
        content: "Your name, the voice Fireside speaks in, what it remembers, and what's stored about you.",
      },
      { property: "og:title", content: "Settings — Fireside AI" },
      {
        property: "og:description",
        content: "Your name, the voice Fireside speaks in, and what it remembers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const prefsFn = useServerFn(getPrefs);
  const updateFn = useServerFn(updatePrefs);
  const usageFn = useServerFn(getUsageSummary);

  const prefs = useQuery({ queryKey: ["prefs"], queryFn: () => prefsFn() });
  const usage = useQuery({ queryKey: ["usage"], queryFn: () => usageFn() });

  const [name, setName] = useState("");
  useEffect(() => {
    if (prefs.data?.displayName) setName(prefs.data.displayName);
  }, [prefs.data?.displayName]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prefs"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };

  const save = useMutation({
    mutationFn: () => updateFn({ data: { displayName: name.trim() } }),
    onSuccess: () => {
      invalidate();
      toast.success("Saved.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const patch = useMutation({
    mutationFn: (v: { voiceId?: string; memoryEnabled?: boolean; reflectionOptin?: boolean }) =>
      updateFn({ data: v }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const u = usage.data;

  return (
    <AppShell>
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="serif text-2xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Small things, quietly kept.</p>

        <section className="mt-10 space-y-4">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">You</h2>
          <div>
            <Label htmlFor="display" className="text-xs text-muted-foreground">
              Display name
            </Label>
            {prefs.isLoading ? (
              <Skeleton className="mt-2 h-9 w-full" />
            ) : (
              <Input
                id="display"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
                maxLength={40}
              />
            )}
            <p className="mt-2 text-xs text-muted-foreground">{prefs.data?.email}</p>
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name.trim() || name.trim() === prefs.data?.displayName}
            className="w-full rounded-full"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">The voice Fireside speaks in</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {AI_VOICES.map((v) => {
              const active = (prefs.data?.voiceId ?? AI_VOICES[0].id) === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => patch.mutate({ voiceId: v.id })}
                  className={
                    active
                      ? "rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-left"
                      : "rounded-xl border border-border/60 bg-card px-4 py-3 text-left hover:border-primary/40"
                  }
                >
                  <p className="text-sm">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.note}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Memory &amp; reflections</h2>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-accent/30 px-4 py-3">
            <div>
              <p className="text-sm">Let Fireside remember</p>
              <p className="text-xs text-muted-foreground">Turn this off and nothing new is kept.</p>
            </div>
            <Switch
              aria-label="Toggle memory"
              checked={prefs.data?.memoryEnabled ?? true}
              onCheckedChange={(v) => patch.mutate({ memoryEnabled: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-accent/30 px-4 py-3">
            <div>
              <p className="text-sm">Reflections on journal entries</p>
              <p className="text-xs text-muted-foreground">A few gentle sentences back, only if you want them.</p>
            </div>
            <Switch
              aria-label="Toggle journal reflections"
              checked={prefs.data?.reflectionOptin ?? false}
              onCheckedChange={(v) => patch.mutate({ reflectionOptin: v })}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              to="/memory"
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm hover:border-primary/40"
            >
              <Brain className="h-4 w-4 text-primary" />
              What Fireside remembers
            </Link>
            <Link
              to="/journal"
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm hover:border-primary/40"
            >
              <NotebookPen className="h-4 w-4 text-primary" />
              Your journal
            </Link>
          </div>
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Today</h2>
          {usage.isLoading || !u ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border/60 bg-card p-5 text-sm">
              <p className="text-muted-foreground">
                Plan: <span className="text-foreground">{u.plan === "free" ? "By the fire (free)" : "Warm Ember"}</span>
              </p>
              <p className="mt-2 text-muted-foreground">
                Messages today: {u.messagesToday}
                {u.messageLimit ? ` of ${u.messageLimit}` : " — unlimited"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Voice today: {Math.round(u.voiceSecondsToday / 60)} min
                {u.voiceSecondsLimit ? ` of ${Math.round(u.voiceSecondsLimit / 60)}` : " — unlimited"}
              </p>
              <p className="mt-1 text-muted-foreground">
                {u.journalEntries} journal entries · {u.memories} things remembered
              </p>
              <Link to="/pricing" className="mt-3 inline-block text-xs text-primary hover:underline">
                See plans
              </Link>
            </div>
          )}
        </section>

        <section className="mt-12 space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Your data</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Fireside stores your account details, your conversations, your journal entries and the short facts it
            remembers about you. Nothing is sold, and nothing is used to nudge you back. You can clear memory from the
            memory page and delete any journal entry at any time. To delete your account and everything with it, email
            us and it's done within seven days.
          </p>
          <p className="text-xs text-muted-foreground">{DISCLAIMER}</p>
        </section>

        <Button onClick={signOut} variant="outline" className="mt-10 w-full rounded-full">
          <LogOut className="mr-2 h-4 w-4" /> Log Out
        </Button>
      </main>
    </AppShell>
  );
}
