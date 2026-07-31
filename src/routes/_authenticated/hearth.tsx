import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ensureHearthRoom, getConversation, sendMessage } from "@/lib/hearth.functions";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, SendHorizonal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hearth")({
  head: () => ({
    meta: [
      { title: "The Hearth — Fireside AI" },
      { name: "description", content: "A distraction-free one-on-one conversation with a gentle AI companion." },
      { property: "og:title", content: "The Hearth — Fireside AI" },
      { property: "og:description", content: "A distraction-free one-on-one conversation with a gentle AI companion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HearthPage,
});

type Msg = { id: string; role: string; content: string; created_at: string };

function HearthPage() {
  const qc = useQueryClient();
  const ensureFn = useServerFn(ensureHearthRoom);
  const getFn = useServerFn(getConversation);
  const sendFn = useServerFn(sendMessage);

  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const room = useQuery({ queryKey: ["hearth-room"], queryFn: () => ensureFn({ data: undefined }) });
  const roomId = room.data?.id;

  const convo = useQuery({
    queryKey: ["hearth-convo", roomId],
    queryFn: () => getFn({ data: { id: roomId! } }),
    enabled: !!roomId,
  });

  const messages = (convo.data?.messages ?? []) as Msg[];

  const send = useMutation({
    mutationFn: (content: string) => sendFn({ data: { conversationId: roomId!, content, attachments: [] } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hearth-convo", roomId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "The fire flickered. Try again."),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, send.isPending]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || !roomId || send.isPending) return;
    setText("");
    send.mutate(v);
  };

  const loading = room.isLoading || convo.isLoading;

  return (
    <AppShell>
      <main className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col px-5">
        <p className="py-4 text-center text-xs italic text-muted-foreground">
          Let the fire do the talking. (Powered by Gemma-4)
        </p>

        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="ml-auto h-12 w-1/2" />
              <Skeleton className="h-12 w-3/5" />
            </div>
          ) : messages.length === 0 ? (
            <p className="pt-16 text-center text-sm italic text-muted-foreground">
              The fire is lit. Say anything, or nothing at all.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary/15 px-4 py-2.5 text-sm text-foreground"
                      : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm text-muted-foreground"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))
          )}

          {send.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-card px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-border/50 py-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Say something…"
            className="rounded-full"
            disabled={loading}
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={loading || send.isPending || !text.trim()}>
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </AppShell>
  );
}
