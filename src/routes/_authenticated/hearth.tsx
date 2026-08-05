import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureHearthRoom,
  getConversation,
  sendMessage,
  createUploadUrl,
  generateImage,
  generateDocument,
} from "@/lib/hearth.functions";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTED_UPLOADS } from "@/lib/uploads";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, SendHorizonal, Paperclip, ImagePlus, FileText, X, Download } from "lucide-react";


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
type Msg = { id: string; role: string; content: string; created_at: string; attachments?: Attachment[] };

function AttachmentView({ attachment }: { attachment: Attachment }) {
  if (attachment.type.startsWith("image/")) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img src={attachment.url} alt={attachment.name} className="max-h-64 rounded-lg object-cover" loading="lazy" />
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
      <Download className="h-3.5 w-3.5" />
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

  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const room = useQuery({ queryKey: ["hearth-room"], queryFn: () => ensureFn({ data: undefined }) });
  const roomId = room.data?.id;

  const convo = useQuery({
    queryKey: ["hearth-convo", roomId],
    queryFn: () => getFn({ data: { id: roomId! } }),
    enabled: !!roomId,
  });

  const messages = (convo.data?.messages ?? []) as Msg[];
  const refresh = () => qc.invalidateQueries({ queryKey: ["hearth-convo", roomId] });

  const send = useMutation({
    mutationFn: (payload: { content: string; attachments: Attachment[] }) =>
      sendFn({ data: { conversationId: roomId!, content: payload.content, attachments: payload.attachments } }),
    onSuccess: () => {
      setPending([]);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The fire flickered. Try again."),
  });

  const genImage = useMutation({
    mutationFn: (prompt: string) => genImageFn({ data: { conversationId: roomId!, prompt } }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Image failed"),
  });

  const genDoc = useMutation({
    mutationFn: (prompt: string) => genDocFn({ data: { conversationId: roomId!, prompt } }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Document failed"),
  });

  const busy = send.isPending || genImage.isPending || genDoc.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length || !roomId) return;
    setUploading(true);
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
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if ((!v && pending.length === 0) || !roomId || busy || uploading) return;
    setText("");
    send.mutate({ content: v, attachments: pending });
  };

  const askImage = () => {
    const p = window.prompt("Describe the image you'd like the fire to conjure:");
    if (p?.trim()) genImage.mutate(p.trim());
  };
  const askDoc = () => {
    const p = window.prompt("What should I write for you? (a letter, notes, a poem…)");
    if (p?.trim()) genDoc.mutate(p.trim());
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

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-card px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs">
                <span className="max-w-[160px] truncate">{a.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-border/50 py-4">
          <input ref={fileRef} type="file" multiple hidden onChange={handleFilePick} accept={ACCEPTED_UPLOADS} />
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
            aria-label="Generate an image"
            title="Generate an image"
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
            aria-label="Write a document"
            title="Write a document"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={uploading ? "Uploading…" : "Say something…"}
            className="rounded-full"
            aria-label="Message"
            disabled={loading || uploading}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            aria-label="Send message"
            disabled={loading || busy || uploading || (!text.trim() && pending.length === 0)}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </AppShell>
  );
}
