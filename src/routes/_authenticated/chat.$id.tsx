import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConversation, sendMessage, getMe } from "@/lib/hearth.functions";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  component: Chat,
});

function Chat() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getConvFn = useServerFn(getConversation);
  const sendFn = useServerFn(sendMessage);
  const getMeFn = useServerFn(getMe);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conv = useQuery({
    queryKey: ["conv", id],
    queryFn: () => getConvFn({ data: { id } }),
    retry: false,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });

  const send = useMutation({
    mutationFn: (content: string) => sendFn({ data: { conversationId: id, content } }),
    onMutate: async (content) => {
      // Optimistic user message
      await qc.cancelQueries({ queryKey: ["conv", id] });
      const prev = qc.getQueryData<any>(["conv", id]);
      if (prev) {
        qc.setQueryData(["conv", id], {
          ...prev,
          messages: [
            ...prev.messages,
            { id: `temp-${Date.now()}`, role: "user", content, created_at: new Date().toISOString() },
          ],
        });
      }
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conv", id] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["rooms"] });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["conv", id], ctx.prev);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conv.data?.messages.length, send.isPending]);

  useEffect(() => { textareaRef.current?.focus(); }, [id]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || send.isPending) return;
    setInput("");
    send.mutate(text);
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

  const outOfWords = me.data?.messagesRemaining === 0;
  const remaining = me.data?.messagesRemaining ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate({ to: "/dashboard" })} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to rooms
          </button>
          <h2 className="serif text-lg truncate max-w-[50%]">{conv.data?.conversation.title}</h2>
          <span className="text-xs text-muted-foreground">{remaining} words left today</span>
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
            {conv.data?.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card warm-border rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {send.isPending && (
              <div className="flex justify-start">
                <div className="bg-card warm-border rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-muted-foreground italic">
                  <span className="inline-block animate-pulse">thinking…</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-3xl px-6 py-4">
          {outOfWords ? (
            <p className="serif italic text-center text-muted-foreground py-4">
              You've used all your words for today. The fire's banked. I'll be here tomorrow. Rest well.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-3 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder="Say something. Or nothing much."
                rows={2}
                className="resize-none rounded-2xl bg-background"
                disabled={send.isPending}
              />
              <Button type="submit" disabled={!input.trim() || send.isPending} size="icon" className="rounded-full h-12 w-12 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          )}
          {!outOfWords && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              {remaining} {remaining === 1 ? "word" : "words"} left today · Scarcity makes words matter
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
