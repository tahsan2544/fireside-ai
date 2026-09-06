import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useMe, useSiteSettings } from "@/components/AppShell";
import {
  listCommonsRooms,
  postToCommons,
  reportCommonsMessage,
  listBlocks,
  toggleBlock,
} from "@/lib/fireside.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SendHorizonal, Users, Flag, EyeOff, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/commons")({
  head: () => ({
    meta: [
      { title: "The Commons — Fireside AI" },
      {
        name: "description",
        content: "Quiet rooms where people sit together in real time. Gratitude, grief, late night — or the main fire.",
      },
      { property: "og:title", content: "The Commons — Fireside AI" },
      {
        property: "og:description",
        content: "Quiet rooms where people sit together in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Commons,
});

type ChatMsg = {
  id: string;
  user_id: string;
  display_name: string;
  content: string;
  created_at: string;
  room_slug?: string;
};

const GUIDELINES_KEY = "fireside-commons-guidelines";

function Commons() {
  const me = useMe();
  const site = useSiteSettings();
  const name = me.data?.displayName ?? "";
  const userId = (me.data as { userId?: string } | undefined)?.userId;

  const roomsFn = useServerFn(listCommonsRooms);
  const postFn = useServerFn(postToCommons);
  const reportFn = useServerFn(reportCommonsMessage);
  const blocksFn = useServerFn(listBlocks);
  const blockFn = useServerFn(toggleBlock);

  const rooms = useQuery({ queryKey: ["commons-rooms"], queryFn: () => roomsFn(), staleTime: 300_000 });
  const blocks = useQuery({ queryKey: ["commons-blocks"], queryFn: () => blocksFn() });

  const [room, setRoom] = useState("main");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [online, setOnline] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const blocked = useMemo(() => new Set(blocks.data ?? []), [blocks.data]);
  const roomList = useMemo(
    () => [{ slug: "main", name: "The main fire", description: "Everyone, all together." }, ...(rooms.data ?? []).filter((r) => r.slug !== "main")],
    [rooms.data]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(GUIDELINES_KEY)) setShowGuidelines(true);
  }, []);

  // history for the current room
  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setMessages([]);
    supabase
      .from("commons_messages")
      .select("id, user_id, display_name, content, created_at, room_slug")
      .eq("room_slug", room)
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Couldn't open this room.");
          return;
        }
        setMessages((data ?? []).slice().reverse() as ChatMsg[]);
      });
    return () => {
      cancelled = true;
    };
  }, [name, room]);

  // realtime rows + presence, per room
  useEffect(() => {
    if (!name) return;
    const channel = supabase.channel(`commons:${room}`, {
      config: { private: true, presence: { key: name } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "commons_messages", filter: `room_slug=eq.${room}` },
        (payload) => {
          const row = payload.new as ChatMsg;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on("presence", { event: "sync" }, () => setOnline(Object.keys(channel.presenceState())))
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
  }, [name, room]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await postFn({ data: { roomSlug: room, content } });
      const row = res.message as ChatMsg;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      if (res.crisis) {
        toast("If things feel heavy, you can call or text 988 (US) any time.", { duration: 8000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't send.");
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const report = async (id: string) => {
    try {
      await reportFn({ data: { messageId: id, reason: "" } });
      toast.success("Reported quietly. Someone will look.");
    } catch {
      toast.error("Couldn't report that.");
    }
  };

  const mute = async (target: string, on: boolean) => {
    try {
      await blockFn({ data: { blockedUserId: target, blocked: on } });
      blocks.refetch();
      toast.success(on ? "Muted. You won't see them here." : "Unmuted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't do that.");
    }
  };

  if (site.data && !site.data.commons_enabled) {
    return (
      <AppShell>
        <main className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="serif text-2xl">The Commons is closed for now</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The keeper has let this fire rest. Try the Hearth instead.
          </p>
        </main>
      </AppShell>
    );
  }

  const visible = messages.filter((m) => !blocked.has(m.user_id));

  return (
    <AppShell>
      <Dialog open={showGuidelines} onOpenChange={setShowGuidelines}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="serif text-xl">Before you speak here</DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <span className="block">This is a shared room with real people. Keep it warm.</span>
              <span className="block">· Listen more than you correct. No advice unless it's asked for.</span>
              <span className="block">· No harassment, cruelty, or sexual content.</span>
              <span className="block">· Don't share anything you'd mind a stranger holding.</span>
              <span className="block">· Mute or report anyone who makes this place feel unsafe.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="rounded-full"
              onClick={() => {
                window.localStorage.setItem(GUIDELINES_KEY, "1");
                setShowGuidelines(false);
              }}
            >
              I'll sit gently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="mx-auto flex h-[calc(100vh-57px)] max-w-3xl flex-col px-5">
        <div className="flex flex-wrap gap-1.5 pt-4">
          {roomList.map((r) => (
            <button
              key={r.slug}
              onClick={() => setRoom(r.slug)}
              title={r.description}
              className={
                r.slug === room
                  ? "rounded-full bg-primary/15 px-3 py-1.5 text-xs text-foreground"
                  : "rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50"
              }
            >
              {r.name}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4 text-xs">
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
          {visible.length === 0 ? (
            <p className="pt-16 text-center text-sm italic text-muted-foreground">
              The room is quiet right now. You can talk, listen, or simply sit here.
            </p>
          ) : (
            visible.map((m) => {
              const mine = !!userId && m.user_id === userId;
              return (
                <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div className="group max-w-[80%]">
                    <div className="mb-1 flex items-baseline gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/80">{m.display_name}</span>
                      <span>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {!mine && (
                        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            aria-label="Report message"
                            className="hover:text-destructive"
                            onClick={() => report(m.id)}
                          >
                            <Flag className="h-3 w-3" />
                          </button>
                          <button
                            aria-label={blocked.has(m.user_id) ? "Unmute person" : "Mute person"}
                            className="hover:text-foreground"
                            onClick={() => mute(m.user_id, !blocked.has(m.user_id))}
                          >
                            {blocked.has(m.user_id) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </button>
                        </span>
                      )}
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
            maxLength={2000}
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
