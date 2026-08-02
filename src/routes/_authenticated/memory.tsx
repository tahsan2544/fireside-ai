import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMemories, upsertMemory, deleteMemory, forgetEverything, getPrefs, updatePrefs } from "@/lib/fireside.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, Pencil, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({
    meta: [
      { title: "What Fireside remembers — Fireside AI" },
      { name: "description", content: "See, edit or delete everything Fireside remembers about you. Memory is yours to keep or clear." },
      { property: "og:title", content: "What Fireside remembers — Fireside AI" },
      { property: "og:description", content: "See, edit or delete everything Fireside remembers about you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemoryPage,
});

type Fact = { id: string; kind: string; content: string; created_at: string };

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
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories"] });

  const add = useMutation({
    mutationFn: (content: string) => upsertFn({ data: { content, kind: "note" } }),
    onSuccess: () => {
      setDraft("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });

  const edit = useMutation({
    mutationFn: (v: { id: string; content: string }) => upsertFn({ data: v }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
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

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-6 py-14">
        <h1 className="serif text-2xl">What Fireside remembers about you</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only things a friend would naturally hold onto. Edit or delete anything, any time. Nothing here is ever used
          to nudge you back.
        </p>

        <div className="mt-6 flex items-center justify-between rounded-xl bg-accent/30 px-4 py-3">
          <div>
            <p className="text-sm">Let Fireside remember</p>
            <p className="text-xs text-muted-foreground">Turn this off and nothing new is kept.</p>
          </div>
          <Switch
            checked={prefs.data?.memoryEnabled ?? true}
            onCheckedChange={(v) => toggleMemory.mutate(v)}
            aria-label="Toggle memory"
          />
        </div>

        <div className="mt-6 flex gap-2">
          <Label htmlFor="new-memory" className="sr-only">
            Add a memory
          </Label>
          <Input
            id="new-memory"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Something you'd like remembered…"
            maxLength={300}
          />
          <Button disabled={!draft.trim() || add.isPending} onClick={() => add.mutate(draft.trim())}>
            Add
          </Button>
        </div>

        <div className="mt-8 space-y-2">
          {facts.isLoading ? (
            <>
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </>
          ) : rows.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Nothing remembered yet.</p>
          ) : (
            rows.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-3">
                {editing === f.id ? (
                  <>
                    <Input value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={300} />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Save"
                      onClick={() => edit.mutate({ id: f.id, content: editText.trim() })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="min-w-0 flex-1 break-words text-sm">{f.content}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit memory"
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
                      aria-label="Delete memory"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(f.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {rows.length > 0 && (
          <Button variant="outline" className="mt-8 rounded-full" onClick={() => clearAll.mutate()}>
            Forget everything
          </Button>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          Back to{" "}
          <Link to="/settings" className="text-primary hover:underline">
            Settings
          </Link>
          .
        </p>
      </main>
    </AppShell>
  );
}
