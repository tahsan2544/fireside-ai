import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMemories,
  upsertMemory,
  deleteMemory,
  forgetEverything,
  getPrefs,
  updatePrefs,
} from "@/lib/fireside.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "What Fireside remembers — Fireside AI" },
      {
        name: "description",
        content: "See, edit or delete everything Fireside remembers about you. Memory is yours to keep or clear.",
      },
      { property: "og:title", content: "What Fireside remembers — Fireside AI" },
      { property: "og:description", content: "See, edit or delete everything Fireside remembers about you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemoryPage,
});

type Fact = { id: string; kind: string; content: string; created_at: string };

const KINDS = [
  { key: "about", label: "About me" },
  { key: "working_on", label: "What I'm working on" },
  { key: "preference", label: "Preferences" },
  { key: "person", label: "People" },
  { key: "helps", label: "Things that help" },
  { key: "note", label: "Things I asked Fireside to remember" },
] as const;

function labelFor(kind: string) {
  return KINDS.find((k) => k.key === kind)?.label ?? "Things I asked Fireside to remember";
}

function MemoryPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemories);
  const upsertFn = useServerFn(upsertMemory);
  const delFn = useServerFn(deleteMemory);
  const clearFn = useServerFn(forgetEverything);
  const prefsFn = useServerFn(getPrefs);
  const updateFn = useServerFn(updatePrefs);

  const facts = useQuery({ queryKey: ["memories"], queryFn: () => listFn() });
  const prefs = useQuery({ queryKey: ["prefs"], queryFn: () => prefsFn() });

  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<string>("note");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories"] });

  const add = useMutation({
    mutationFn: (content: string) => upsertFn({ data: { content, kind: draftKind } }),
    onSuccess: () => {
      setDraft("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "That didn't save. Try again."),
  });

  const edit = useMutation({
    mutationFn: (v: { id: string; content: string }) => upsertFn({ data: v }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "That didn't save. Try again."),
  });

  const remove = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: invalidate });
  const clearAll = useMutation({
    mutationFn: () => clearFn(),
    onSuccess: () => {
      invalidate();
      toast.success("Cleared. We start fresh.");
    },
  });

  const toggleMemory = useMutation({
    mutationFn: (v: boolean) => updateFn({ data: { memoryEnabled: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prefs"] }),
  });

  const rows = (facts.data ?? []) as Fact[];
  const grouped = KINDS.map((k) => ({
    ...k,
    items: rows.filter((r) => (KINDS.some((kk) => kk.key === r.kind) ? r.kind : "note") === k.key),
  })).filter((g) => g.items.length > 0);

  const renderRow = (f: Fact) => (
    <li key={f.id} className="settle group surface-2 warm-border flex items-start gap-2 rounded-xl px-4 py-3">
      {editing === f.id ? (
        <>
          <Label htmlFor={`edit-${f.id}`} className="sr-only">
            Edit memory
          </Label>
          <Input
            id={`edit-${f.id}`}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            maxLength={300}
          />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Save memory"
            onClick={() => edit.mutate({ id: f.id, content: editText.trim() })}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Cancel editing" onClick={() => setEditing(null)}>
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm leading-relaxed">{f.content}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Kept {new Date(f.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Edit memory: ${f.content.slice(0, 40)}`}
            onClick={() => {
              setEditing(f.id);
              setEditText(f.content);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete memory: ${f.content.slice(0, 40)}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => remove.mutate(f.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </li>
  );

  return (
    <AppShell>
      <main className="relative mx-auto max-w-2xl px-6 py-14">
        <div className="hearth-glow-soft ambient pointer-events-none absolute inset-x-0 top-0 h-56 rotate-180" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="serif text-3xl">Memories</h1>
            <p className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "thing" : "things"} kept
            </p>
          </div>
        </div>
        <p className="reading mt-3 text-sm text-muted-foreground">
          Fireside remembers only what you choose to keep. Everything kept is listed here — edit it, delete it, or clear
          all of it at once.
        </p>

        <div className="mt-8 flex items-center justify-between rounded-xl border border-border/60 bg-accent/25 px-4 py-3 transition-colors">
          <div>
            <p className="text-sm">Let Fireside remember</p>
            <p className="text-xs text-muted-foreground">Turn this off and nothing new is kept.</p>
          </div>
          <Switch
            checked={prefs.data?.memoryEnabled ?? true}
            onCheckedChange={(v) => toggleMemory.mutate(v)}
            aria-label="Let Fireside remember"
          />
        </div>

        <div className="surface-1 mt-6 rounded-xl border border-border/60 p-4">
          <Label htmlFor="new-memory" className="text-xs text-muted-foreground">
            Add something to remember
          </Label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <Input
              id="new-memory"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && draft.trim() && add.mutate(draft.trim())}
              placeholder="Something you'd like remembered…"
              maxLength={300}
            />
            <div className="flex gap-2">
              <Label htmlFor="new-memory-kind" className="sr-only">
                Category
              </Label>
              <select
                id="new-memory-kind"
                value={draftKind}
                onChange={(e) => setDraftKind(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
              <Button disabled={!draft.trim() || add.isPending} onClick={() => add.mutate(draft.trim())} className="rounded-full">
                <Plus className="h-4 w-4" /> Keep
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-10">
          {facts.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : rows.length === 0 ? (
            <div className="settle rounded-xl border border-dashed border-border/70 px-6 py-12 text-center">
              <Brain className="mx-auto h-6 w-6 text-primary/70" aria-hidden="true" />
              <h2 className="serif mt-4 text-xl">Nothing kept yet.</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                As you talk at the Hearth, small things worth remembering will appear here — or add one yourself above.
              </p>
            </div>
          ) : (
            grouped.map((g) => (
              <section key={g.key}>
                <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{g.label}<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{g.items.length}</span></h2>
                <ul className="mt-3 space-y-2">{g.items.map(renderRow)}</ul>
              </section>
            ))
          )}
        </div>

        {rows.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-10 rounded-full">
                Forget everything
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="serif">Forget everything?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes all {rows.length} {rows.length === 1 ? "memory" : "memories"} for good. Your
                  conversations and journal entries stay as they are.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep them</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearAll.mutate()}>Forget everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <p className="mt-12 text-xs leading-relaxed text-muted-foreground">
          Your conversations belong to your account. Your memories are editable and removable. Fireside won't keep
          something as a memory unless you ask it to.
        </p>
      </main>
    </AppShell>
  );
}

export { labelFor };
