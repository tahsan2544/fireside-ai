import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMe, useSiteSettings } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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

type ChatMsg = { id: string; user_id: string; display_name: string; content: string; created_at: string };

function Commons() {
  const me = useMe();
  const site = useSiteSettings();
  const name = me.data?.displayName ?? "";
  const userId = (me.data as { userId?: string } | undefined)?.userId;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load recent history (RLS: signed-in only)
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    supabase
      .from("commons_messages")
      .select("id, user_id, display_name, content, created_at")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Couldn't open the Commons.");
          return;
        }
        setMessages((data ?? []).slice().reverse() as ChatMsg[]);
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Private realtime channel: rows via postgres_changes (RLS), presence for who's here
  useEffect(() => {
    if (!name) return;
    const channel = supabase.channel("commons", {
      config: { private: true, presence: { key: name } },
    });

    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "commons_messages" }, (payload) => {
        const row = payload.new as ChatMsg;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
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
      setReady(false);
    };
  }, [name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("Your session ended. Sign in again.");
      setSending(false);
      return;
    }
    const { data, error } = await supabase
      .from("commons_messages")
      .insert({ user_id: uid, display_name: name, content })
      .select("id, user_id, display_name, content, created_at")
      .single();
    setSending(false);
    if (error) {
      toast.error(error.message.includes("row-level") ? "You can't post right now." : "That didn't send.");
      setText(content);
      return;
    }
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as ChatMsg]));
  };

  if (site.data && !site.data.commons_enabled) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="serif text-2xl">The Commons is closed for now</h1>
          <p className="mt-2 text-sm text-muted-foreground">The keeper has let this fire rest. Try the Hearth instead.</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto flex h-[calc(100vh-57px)] max-w-3xl flex-col px-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 py-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-primary" /> Sitting by the fire:
          </span>
          {!ready ? (
            <Skeleton className="h-5 w-40" />
          ) : online.length === 0 ? (
            <span className="italic text-muted-foreground">just the embers</span>
          ) : (
            online.map((n) => (
              <span key={n} className="rounded-full bg-accent/60 px-2.5 py-0.5 text-accent-foreground">
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
            messages.map((m) => {
              const mine = m.display_name === name || (!!userId && m.user_id === userId);
              return (
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div className="max-w-[80%]">
                    <div className="mb-1 flex items-baseline gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/80">{m.display_name}</span>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div
                      className={
                        mine
                          ? "whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary/15 px-4 py-2.5 text-sm text-foreground"
                          : "whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm text-card-foreground warm-border"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-border/60 py-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={ready ? "Speak to the room…" : "Joining the room…"}
            className="rounded-full"
            disabled={!ready}
          />
          <Button type="submit" size="icon" className="rounded-full" disabled={!ready || !text.trim() || sending}>
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </AppShell>
  );
}
