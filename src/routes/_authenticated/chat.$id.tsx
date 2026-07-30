import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getConversation,
  sendMessage,
  getMe,
  deleteConversation,
  createUploadUrl,
  generateImage,
  generateDocument,
} from "@/lib/hearth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { VoiceRoom } from "@/components/VoiceRoom";
import { ArrowLeft, Send, Paperclip, ImagePlus, FileText, Trash2, X, Download, Mic } from "lucide-react";


export const Route = createFileRoute("/_authenticated/chat/$id")({
  component: Chat,
});

type PendingAttachment = { url: string; type: string; name: string };

function Chat() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getConvFn = useServerFn(getConversation);
  const sendFn = useServerFn(sendMessage);
  const getMeFn = useServerFn(getMe);
  const delFn = useServerFn(deleteConversation);
  const uploadUrlFn = useServerFn(createUploadUrl);
  const genImageFn = useServerFn(generateImage);
  const genDocFn = useServerFn(generateDocument);

  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const conv = useQuery({
    queryKey: ["conv", id],
    queryFn: () => getConvFn({ data: { id } }),
    retry: false,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });

  const send = useMutation({
    mutationFn: (payload: { content: string; attachments: PendingAttachment[] }) =>
      sendFn({ data: { conversationId: id, content: payload.content, attachments: payload.attachments } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conv", id] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setPending([]);
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });

  const genImage = useMutation({
    mutationFn: (prompt: string) => genImageFn({ data: { conversationId: id, prompt } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conv", id] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Image failed"),
  });
  const genDoc = useMutation({
    mutationFn: (prompt: string) => genDocFn({ data: { conversationId: id, prompt } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conv", id] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Document failed"),
  });

  const remove = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate({ to: "/dashboard" });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not close the room"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conv.data?.messages.length, send.isPending, genImage.isPending, genDoc.isPending]);

  useEffect(() => { textareaRef.current?.focus(); }, [id]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const uploaded: PendingAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too big (max 20MB)`);
          continue;
        }
        const { path, token } = await uploadUrlFn({ data: { conversationId: id, filename: file.name } });
        const { error } = await supabase.storage.from("chat-attachments").uploadToSignedUrl(path, token, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (error) throw error;
        const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 365);
        uploaded.push({ url: signed?.signedUrl ?? "", type: file.type || "application/octet-stream", name: file.name });
      }
      setPending((p) => [...p, ...uploaded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && pending.length === 0) || send.isPending) return;
    setInput("");
    send.mutate({ content: text, attachments: pending });
  };

  const handleImageGen = () => {
    const p = window.prompt("Describe the image you'd like the fire to conjure:");
    if (p && p.trim()) genImage.mutate(p.trim());
  };
  const handleDocGen = () => {
    const p = window.prompt("What document should I write for you? (a poem, a letter, notes on something…)");
    if (p && p.trim()) genDoc.mutate(p.trim());
  };
  const handleVoice = () => {
    toast.info("Live voice needs an ElevenLabs connection. Ask Lovable to connect ElevenLabs to enable it.");
  };

  if (conv.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="serif text-lg text-muted-foreground italic">This room doesn't exist.</p>
          <Button asChild variant="link" className="mt-2"><Link to="/dashboard">← Back to your rooms</Link></Button>
        </div>
      </div>
    );
  }

  const busy = send.isPending || genImage.isPending || genDoc.isPending;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between gap-3">
          <button onClick={() => navigate({ to: "/dashboard" })} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="serif text-lg truncate max-w-[50%]">{conv.data?.conversation.title}</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (confirm("Close this room? The conversation and its files will be lost.")) remove.mutate(); }}
              className="text-muted-foreground hover:text-destructive text-sm inline-flex items-center gap-1"
              aria-label="Close room"
            >
              <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Close room</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 -z-10 hearth-glow-soft pointer-events-none" />
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-8 space-y-4">
            {conv.data?.messages.length === 0 && (
              <div className="text-center py-16">
                <p className="serif italic text-lg text-muted-foreground">
                  Hey. I'm glad you're here.<br />What's on your mind — or not on your mind? Either is fine.
                </p>
              </div>
            )}
            {conv.data?.messages.map((m: any) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card warm-border rounded-bl-sm"
                  }`}
                >
                  {m.content && <div>{m.content}</div>}
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.attachments.map((a: PendingAttachment, i: number) => (
                        <AttachmentView key={i} attachment={a} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-card warm-border rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-muted-foreground italic">
                  <span className="inline-block animate-pulse">
                    {genImage.isPending ? "conjuring an image…" : genDoc.isPending ? "writing…" : "thinking…"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4">
          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pending.map((a, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs">
                  <span className="truncate max-w-[160px]">{a.name}</span>
                  <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <input ref={fileRef} type="file" multiple hidden onChange={handleFilePick} accept="image/*,.pdf,.txt,.md,.doc,.docx" />
            <div className="flex gap-1 pb-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={uploading || busy} title="Attach photo or document">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleImageGen} disabled={busy} title="Generate an image">
                <ImagePlus className="w-4 h-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleDocGen} disabled={busy} title="Generate a document">
                <FileText className="w-4 h-4" />
              </Button>
            </div>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder={uploading ? "Uploading…" : "Say something. Or nothing much."}
              rows={2}
              className="resize-none rounded-2xl bg-background"
              disabled={busy || uploading}
            />
            <Button type="submit" disabled={(!input.trim() && pending.length === 0) || busy || uploading} size="icon" className="rounded-full h-12 w-12 shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2 italic">
            Attach • Generate image • Write document • {" "}
            <button onClick={handleVoice} className="underline hover:text-foreground">live voice</button>
          </p>
        </div>
      </div>
    </div>
  );
}

function AttachmentView({ attachment }: { attachment: PendingAttachment }) {
  const isImage = attachment.type.startsWith("image/");
  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
        <img src={attachment.url} alt={attachment.name} className="rounded-lg max-h-72 object-cover" />
      </a>
    );
  }
  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" download={attachment.name}
       className="inline-flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs hover:bg-background">
      <Download className="w-3.5 h-3.5" />
      <span className="truncate max-w-[220px]">{attachment.name}</span>
    </a>
  );
}
