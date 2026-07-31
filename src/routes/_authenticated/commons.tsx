import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMe } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SendHorizonal, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/commons")({
  head: () => ({
    meta: [
      { title: "The Commons — Fireside AI" },
      { name: "description", content: "One shared, real-time room where everyone sitting by the fire can talk." },
      { property: "og:title", content: "The Commons — Fireside AI" },
      { property: "og:description", content: "One shared, real-time room where everyone sitting by the fire can talk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Commons,
});

type ChatMsg = { id: string; name: string; content: string; at: string };

function Commons() {
  const me = useMe();
  const name = me.data?.displayName ?? "";
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!name) return;
    const channel = supabase.channel("commons", { config: { presence: { key: name } } });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as ChatMsg]);
      })
      .on("presence", { event: "sync" }, () => {
        setOnline(Object.keys(channel.presenceState()));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name, at: new Date().toISOString() });
          setReady(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setReady(false);
    };
  }, [name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    const channel = channelRef.current;
    if (!v || !channel || !ready) return;
    const msg: ChatMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      content: v,
      at: new Date().toISOString(),
    };
    channel.send({ type: "broadcast", event: "message", payload: msg });
    setMessages((prev) => [...prev, msg]);
    setText("");
  };

  return (
    <AppShell>
      <main className="mx-auto flex h-[calc(100vh-57px)] max-w-3xl flex-col px-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 py-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" /> Sitting by the fire:
          </span>
          {!ready ? (
            <Skeleton className="h-5 w-40" />
          ) : online.length === 0 ? (
            <span className="italic text-muted-foreground">just the embers</span>
          ) : (
            online.map((n) => (
              <span key={n} className="rounded-full bg-accent/60 px-2.5 py-0.5 text-foreground">
                {n}
              </span>
            ))
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-5">
          {messages.length === 0 ? (
            <p className="pt-16 text-center text-sm italic text-muted-foreground">
              No one has spoken yet. You could be first.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.name === name ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[80%]">
                  <div className="mb-1 flex items-baseline gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/80">{m.name}</span>
                    <span>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div
                    className={
                      m.name === name
                        ? "whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary/15 px-4 py-2.5 text-sm text-foreground"
                        : "whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm text-muted-foreground"
                    }
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-border/50 py-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={ready ? "Speak to the room…" : "Joining the room…"}
            className="rounded-full"
            disabled={!ready}
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={!ready || !text.trim()}>
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </AppShell>
  );
}
