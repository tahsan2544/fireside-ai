import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureHearthRoom,
  getConversation,
  createUploadUrl,
  generateImage,
  generateDocument,
} from "@/lib/hearth.functions";
import { listMemories } from "@/lib/fireside.functions";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTED_UPLOADS } from "@/lib/uploads";
import { AppShell } from "@/components/AppShell";
import { VoiceRoom } from "@/components/VoiceRoom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SendHorizonal, Paperclip, ImagePlus, FileText, X, Download, Mic } from "lucide-react";

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

type Attachment = { url: string; type: string; name: string };
type Pending = { path: string; type: string; name: string };
type Msg = { id: string; role: string; content: string; created_at: string; attachments?: Attachment[] };

const SUGGESTIONS = [
  "How was your day?",
  "Help me think this through.",
  "I just want to talk.",
  "Let me tell you something.",
  "Help me reflect on today.",
];

function AttachmentView({ attachment }: { attachment: Attachment }) {
  if (attachment.type.startsWith("image/")) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachment.url}
          alt={`Image shared in this conversation: ${attachment.name}`}
          className="max-h-64 rounded-lg object-cover"
          loading="lazy"
        />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className="inline-flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 text-xs hover:bg-background"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="max-w-[220px] truncate">{attachment.name}</span>
    </a>
  );
}

function HearthPage() {
  const qc = useQueryClient();
  const ensureFn = useServerFn(ensureHearthRoom);
  const getFn = useServerFn(getConversation);
  const sendFn = useServerFn(sendMessage);
  const uploadUrlFn = useServerFn(createUploadUrl);
  const genImageFn = useServerFn(generateImage);
  const genDocFn = useServerFn(generateDocument);
  const memFn = useServerFn(listMemories);

  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const room = useQuery({ queryKey: ["hearth-room"], queryFn: () => ensureFn({ data: undefined }) });
  const roomId = room.data?.id;

  const convo = useQuery({
    queryKey: ["hearth-convo", roomId],
    queryFn: () => getFn({ data: { id: roomId! } }),
    enabled: !!roomId,
  });

  const memories = useQuery({ queryKey: ["memories"], queryFn: () => memFn() });

  const messages = (convo.data?.messages ?? []) as Msg[];
  const refresh = () => qc.invalidateQueries({ queryKey: ["hearth-convo", roomId] });

  const sharedFiles = useMemo(
    () => messages.flatMap((m) => (Array.isArray(m.attachments) ? m.attachments : [])).slice(-8).reverse(),
    [messages]
  );

  const send = useMutation({
    mutationFn: async (payload: { content: string; attachments: Pending[] }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("You're signed out. Refresh the page.");
      const res = await fetch("/api/hearth/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ conversationId: roomId!, ...payload }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Something didn't come through. Try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      setStreaming("");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const event = raw.match(/^event: (.+)$/m)?.[1];
          const dataLine = raw.match(/^data: (.+)$/m)?.[1];
          if (!event || !dataLine) continue;
          const data = JSON.parse(dataLine);
          if (event === "token") setStreaming((s) => (s ?? "") + data.t);
          else if (event === "error") throw new Error(data.message ?? "Something didn't come through. Try again.");
          // "done" just marks completion; the saved row arrives via refresh()
        }
      }
    },
    onSuccess: () => {
      setStreaming(null);
      setPending([]);
      setStatus(null);
      refresh();
    },
    onError: (e) => {
      setStreaming(null);
      setStatus(null);
      toast.error(e instanceof Error ? e.message : "Something didn't come through. Try again.");
    },
  });

  const genImage = useMutation({
    mutationFn: (prompt: string) => genImageFn({ data: { conversationId: roomId!, prompt } }),
    onSuccess: () => {
      setStatus(null);
      refresh();
    },
    onError: (e) => {
      setStatus(null);
      toast.error(e instanceof Error ? e.message : "That image didn't come through. Try again.");
    },
  });

  const genDoc = useMutation({
    mutationFn: (prompt: string) => genDocFn({ data: { conversationId: roomId!, prompt } }),
    onSuccess: () => {
      setStatus(null);
      refresh();
    },
    onError: (e) => {
      setStatus(null);
      toast.error(e instanceof Error ? e.message : "That document didn't come through. Try again.");
    },
  });

  const busy = send.isPending || genImage.isPending || genDoc.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy, streaming?.length]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length || !roomId) return;
    setUploading(true);
    setStatus("Reading your file…");
    try {
      const uploaded: Pending[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too big (max 20MB)`);
          continue;
        }
        const { path, token } = await uploadUrlFn({ data: { conversationId: roomId, filename: file.name } });
        const { error } = await supabase.storage.from("chat-attachments").uploadToSignedUrl(path, token, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (error) throw error;
        uploaded.push({ path, type: file.type || "application/octet-stream", name: file.name });
      }
      setPending((p) => [...p, ...uploaded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That upload didn't come through. Try again.");
    } finally {
      setUploading(false);
      setStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const doSend = (value: string) => {
    if ((!value && pending.length === 0) || !roomId || busy || uploading) return;
    setText("");
    setStatus(pending.length ? "Reading your document…" : "Gathering my thoughts…");
    send.mutate({ content: value, attachments: pending });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    doSend(text.trim());
  };

  const askImage = () => {
    const p = window.prompt("What should the picture show?");
    if (p?.trim()) {
      setStatus("Making a picture…");
      genImage.mutate(p.trim());
    }
  };
  const askDoc = () => {
    const p = window.prompt("What should I write for you? (a letter, notes, a poem…)");
    if (p?.trim()) {
      setStatus("Writing that up…");
      genDoc.mutate(p.trim());
    }
  };

  const loading = room.isLoading || convo.isLoading;
  const empty = !loading && messages.length === 0;

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="flex h-[calc(100dvh-8.5rem)] min-w-0 flex-col sm:h-[calc(100dvh-9rem)]">
          <div className="flex-1 space-y-5 overflow-y-auto py-6" aria-live="polite">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-2/3 rounded-lg" />
                <Skeleton className="ml-auto h-12 w-1/2 rounded-lg" />
                <Skeleton className="h-12 w-3/5 rounded-lg" />
              </div>
            ) : empty ? (
              <div className="settle pt-10">
                <h1 className="serif text-2xl">Nothing here yet.</h1>
                <p className="mt-2 text-sm text-muted-foreground">Start wherever you are.</p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => doSend(s)}
                      className="rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      m.role === "user"
                        ? "settle max-w-[min(38rem,85%)] whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-primary/12 px-4 py-3 text-[0.95rem] leading-relaxed text-foreground"
                        : "settle max-w-[min(38rem,90%)] whitespace-pre-wrap break-words rounded-lg rounded-bl-sm border border-border/60 bg-card px-4 py-3 text-[0.95rem] leading-relaxed text-card-foreground"
                    }
                  >
                    {m.content}
                    {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {m.attachments.map((a, i) => (
                          <AttachmentView key={i} attachment={a} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {busy &&
              (send.isPending && streaming ? (
                <div className="flex justify-start">
                  <p className="settle max-w-[min(38rem,90%)] whitespace-pre-wrap break-words rounded-lg rounded-bl-sm border border-border/60 bg-card px-4 py-3 text-[0.95rem] leading-relaxed text-card-foreground">
                    {streaming}
                    <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary/70 align-text-bottom" aria-hidden="true" />
                  </p>
                </div>
              ) : (
                <div className="flex justify-start">
                  <p className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm italic text-muted-foreground">
                    <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary align-middle" />
                    {status ?? "Gathering my thoughts…"}
                  </p>
                </div>
              ))}
            <div ref={bottomRef} />
          </div>

          {pending.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {pending.map((a, i) => (
                <li key={i} className="flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs">
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${a.name}`}
                    onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={submit}
            className="surface-2 warm-border mb-4 rounded-xl px-3 pb-2 pt-3"
            aria-label="Message composer"
          >
            <input ref={fileRef} type="file" multiple hidden onChange={handleFilePick} accept={ACCEPTED_UPLOADS} />
            <label htmlFor="composer" className="sr-only">
              Say something to Fireside
            </label>
            <Textarea
              id="composer"
              ref={inputRef}
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  doSend(text.trim());
                }
              }}
              placeholder="Say something…"
              className="min-h-[3rem] resize-none border-0 bg-transparent px-1 text-[0.95rem] leading-relaxed shadow-none focus-visible:ring-0"
            />
            <div className="mt-1 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
                disabled={loading || uploading || busy}
                aria-label="Attach a photo or document"
                title="Attach a photo or document"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={askImage}
                disabled={loading || busy}
                aria-label="Ask for a picture"
                title="Ask for a picture"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={askDoc}
                disabled={loading || busy}
                aria-label="Ask for a written document"
                title="Ask for a written document"
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-full px-3 text-xs text-muted-foreground"
                onClick={() => setVoiceOpen(true)}
                disabled={!roomId || busy}
                aria-label="Talk out loud"
              >
                <Mic className="mr-1.5 h-4 w-4" />
                Speak
              </Button>

              <span className="ml-auto text-[11px] text-muted-foreground" aria-live="polite">
                {uploading ? "Reading your file…" : busy ? status ?? "Gathering my thoughts…" : ""}
              </span>

              <Button
                type="submit"
                size="icon"
                className="rounded-full"
                disabled={loading || busy || uploading || (!text.trim() && pending.length === 0)}
                aria-label="Send message"
              >
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </main>

        {/* Contextual panel */}
        <aside className="hidden border-l border-border/50 py-6 pl-6 lg:block" aria-label="Conversation context">
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Remembered</h2>
          <ul className="mt-3 space-y-2">
            {(memories.data ?? []).slice(0, 6).map((m: { id: string; content: string }) => (
              <li key={m.id} className="text-sm leading-relaxed text-muted-foreground">
                {m.content}
              </li>
            ))}
            {(memories.data ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nothing saved yet. Fireside only remembers what you ask it to.
              </li>
            )}
          </ul>

          {sharedFiles.length > 0 && (
            <>
              <h2 className="mt-8 text-xs uppercase tracking-[0.18em] text-muted-foreground">Shared here</h2>
              <ul className="mt-3 space-y-2">
                {sharedFiles.map((f, i) => (
                  <li key={i} className="truncate text-sm text-muted-foreground">
                    <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-foreground">
                      {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">
            Fireside is for conversation and reflection, not therapy or emergency care.
          </p>
        </aside>
      </div>

      {roomId && (
        <VoiceRoom conversationId={roomId} open={voiceOpen} onOpenChange={setVoiceOpen} onTurnComplete={refresh} />
      )}
    </AppShell>
  );
}
