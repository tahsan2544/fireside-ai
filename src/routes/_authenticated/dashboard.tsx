import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, listConversations, createConversation, deleteConversation } from "@/lib/hearth.functions";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DoorOpen, DoorClosed, Trash2, Shield } from "lucide-react";
import { Hearth } from "@/components/Hearth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getMeFn = useServerFn(getMe);
  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const deleteFn = useServerFn(deleteConversation);

  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/chat/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not open a new room"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rooms"] }); qc.invalidateQueries({ queryKey: ["me"] }); },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const info = me.data;
  const roomsFull = info ? info.conversationsUsed >= info.maxConversations : false;
  const outOfWords = info ? info.messagesRemaining === 0 : false;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="scale-[0.2] w-[48px] h-[52px] -ml-6 -my-6"><Hearth size="sm" /></div>
            <div>
              <p className="serif text-lg leading-none">Hearth</p>
              <p className="text-xs text-muted-foreground">Welcome, {info?.displayName ?? "…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Words today: <strong className="text-foreground">{info ? info.messagesRemaining : "…"}/{info?.maxDailyMessages ?? "…"}</strong></span>
            <span>Rooms: <strong className="text-foreground">{info?.conversationsUsed ?? "…"}/{info?.maxConversations ?? "…"}</strong></span>
            {info?.isAdmin && (
              <Link to="/admin" className="text-primary hover:underline inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" />Admin</Link>
            )}
            <button onClick={signOut} className="hover:text-foreground">Step Outside</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="serif text-3xl">Your rooms</h1>
            <p className="text-sm text-muted-foreground mt-1 italic">New words arrive at midnight (UTC).</p>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={roomsFull || create.isPending}
            className="rounded-full"
          >
            <DoorOpen className="w-4 h-4 mr-2" />
            {roomsFull ? "All 10 rooms are full" : "Open a New Room"}
          </Button>
        </div>

        {outOfWords && (
          <div className="mb-6 rounded-xl bg-accent/40 border border-accent/60 p-4 text-sm italic serif text-foreground/80">
            You've used all your words for today. The fire's banked. Rest well — new words arrive at midnight.
          </div>
        )}

        {rooms.isLoading ? (
          <p className="text-muted-foreground text-sm">Kindling the rooms…</p>
        ) : rooms.data?.length === 0 ? (
          <div className="rounded-2xl bg-card warm-border p-12 text-center">
            <p className="serif italic text-lg text-muted-foreground">
              You have no rooms yet.<br />Start a conversation — give it a name or let it name itself.
            </p>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="mt-6 rounded-full">
              <DoorOpen className="w-4 h-4 mr-2" /> Open your first room
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rooms.data?.map((r) => (
              <div key={r.id} className="group rounded-2xl bg-card warm-border p-6 hover:shadow-md transition-shadow relative">
                <Link to="/chat/$id" params={{ id: r.id }} className="block">
                  <div className="flex items-center gap-2 mb-2">
                    <DoorClosed className="w-4 h-4 text-primary" />
                    <h3 className="serif text-lg text-foreground truncate">{r.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {r.preview || <span className="italic">Empty. Waiting.</span>}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-3">
                    Last visited {new Date(r.updatedAt).toLocaleString()}
                  </p>
                </Link>
                <button
                  onClick={() => { if (confirm("Close this room? The conversation will be lost.")) del.mutate(r.id); }}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Close room"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
