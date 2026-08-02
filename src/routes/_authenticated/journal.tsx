import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listJournal,
  saveJournalEntry,
  deleteJournalEntry,
  reflectOnEntry,
  getJournalPrompt,
  getPrefs,
} from "@/lib/fireside.functions";
import { AppShell } from "@/components/AppShell";
import { CrisisNotice } from "@/components/CrisisNotice";
import { MOODS } from "@/lib/voices";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Download, Printer, Trash2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — Fireside AI" },
      { name: "description", content: "A private journal with gentle daily prompts, mood tags and optional AI reflection." },
      { property: "og:title", content: "Journal — Fireside AI" },
      { property: "og:description", content: "A private journal with gentle daily prompts, mood tags and optional AI reflection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JournalPage,
});

type Entry = {
  id: string;
  prompt: string;
  content: string;
  mood: number | null;
  reflection: string | null;
  entry_date: string;
  created_at: string;
};

function JournalPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listJournal);
  const saveFn = useServerFn(saveJournalEntry);
  const delFn = useServerFn(deleteJournalEntry);
  const reflectFn = useServerFn(reflectOnEntry);
  const promptFn = useServerFn(getJournalPrompt);
  const prefsFn = useServerFn(getPrefs);

  const entries = useQuery({ queryKey: ["journal"], queryFn: () => listFn() });
  const prompt = useQuery({ queryKey: ["journal-prompt"], queryFn: () => promptFn(), staleTime: 60 * 60 * 1000 });
  const prefs = useQuery({ queryKey: ["prefs"], queryFn: () => prefsFn() });

  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [wantReflection, setWantReflection] = useState(false);
  const [crisis, setCrisis] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          content: content.trim(),
          prompt: prompt.data?.prompt ?? "",
          mood,
          wantReflection: wantReflection && (prefs.data?.reflectionOptin ?? false),
        },
      }),
    onSuccess: (res) => {
      setContent("");
      setMood(null);
      if (res.crisis) setCrisis(true);
      qc.invalidateQueries({ queryKey: ["journal"] });
      toast.success("Kept, just for you.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save that"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
  });

  const reflect = useMutation({
    mutationFn: (id: string) => reflectFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reflection didn't come through"),
  });

  const rows = (entries.data ?? []) as Entry[];

  const byMonth = useMemo(() => {
    const groups: Record<string, Entry[]> = {};
    rows.forEach((e) => {
      const key = new Date(e.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      (groups[key] ??= []).push(e);
    });
    return Object.entries(groups);
  }, [rows]);

  const exportText = () => {
    const text = rows
      .slice()
      .reverse()
      .map(
        (e) =>
          `${new Date(e.created_at).toLocaleString()}\n${e.prompt ? `Prompt: ${e.prompt}\n` : ""}${
            e.mood ? `Mood: ${MOODS.find((m) => m.value === e.mood)?.label}\n` : ""
          }\n${e.content}\n${e.reflection ? `\n— Fireside: ${e.reflection}\n` : ""}\n${"-".repeat(40)}\n`
      )
      .join("\n");
    const blob = new Blob([text || "No entries yet."], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fireside-journal-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <CrisisNotice open={crisis} onOpenChange={setCrisis} />
      <main className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="serif text-2xl">Journal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Private. Never shown in the Commons, never used anywhere else.
        </p>

        <section className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-sm italic text-muted-foreground">
            {prompt.isLoading ? <Skeleton className="h-4 w-3/4" /> : prompt.data?.prompt}
          </p>
          <Textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write as much or as little as you want."
            className="mt-4 resize-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(mood === m.value ? null : m.value)}
                aria-pressed={mood === m.value}
                aria-label={m.label}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  mood === m.value ? "bg-primary/20 text-foreground" : "bg-accent/40 text-muted-foreground hover:bg-accent/70"
                }`}
              >
                <span className="mr-1">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>

          {prefs.data?.reflectionOptin && (
            <div className="mt-4 flex items-center gap-3">
              <Switch id="reflect" checked={wantReflection} onCheckedChange={setWantReflection} />
              <Label htmlFor="reflect" className="text-xs text-muted-foreground">
                Offer a short reflection on this entry
              </Label>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="rounded-full"
              disabled={!content.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Keep this
            </Button>
            <Button variant="ghost" className="rounded-full" onClick={() => qc.invalidateQueries({ queryKey: ["journal-prompt"] })}>
              Another prompt
            </Button>
          </div>
        </section>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="serif text-lg">Looking back</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={exportText}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Text
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </div>

        {entries.isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-6 text-sm italic text-muted-foreground">Nothing written yet. There's no hurry.</p>
        ) : (
          byMonth.map(([month, items]) => (
            <div key={month} className="mt-8">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{month}</p>
              <div className="mt-3 space-y-3">
                {items.map((e) => (
                  <article key={e.id} className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}{" "}
                        {e.mood ? <span className="ml-1">{MOODS.find((m) => m.value === e.mood)?.emoji}</span> : null}
                      </p>
                      <div className="flex gap-1">
                        {prefs.data?.reflectionOptin && !e.reflection && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Ask for a reflection"
                            disabled={reflect.isPending}
                            onClick={() => reflect.mutate(e.id)}
                          >
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete entry"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove.mutate(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {e.prompt ? <p className="mt-1 text-xs italic text-muted-foreground">{e.prompt}</p> : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm">{e.content}</p>
                    {e.reflection ? (
                      <p className="mt-3 rounded-lg bg-accent/40 px-3 py-2 text-sm text-muted-foreground">
                        {e.reflection}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </AppShell>
  );
}
