import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { voiceTurn } from "@/lib/hearth.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Turn = { role: "user" | "assistant"; text: string };

export function VoiceRoom({
  conversationId,
  open,
  onOpenChange,
  onTurnComplete,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTurnComplete?: () => void;
}) {
  const turnFn = useServerFn(voiceTurn);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      stopEverything();
    }
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopEverything() {
    try {
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    recorderRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setRecording(false);
    setSpeaking(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 2048) {
          toast.error("That was too quiet — try again.");
          return;
        }
        await sendTurn(blob, mime);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("I need microphone access to listen.");
    }
  }

  function stopRecording() {
    setRecording(false);
    recorderRef.current?.stop();
  }

  async function sendTurn(blob: Blob, mime: string) {
    setBusy(true);
    try {
      const buf = await blob.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const audioBase64 = btoa(binary);

      const res = await turnFn({ data: { conversationId, audioBase64, mimeType: mime } });
      setTurns((t) => [...t, { role: "user", text: res.transcript }, { role: "assistant", text: res.reply }]);
      onTurnComplete?.();

      const audio = new Audio(`data:audio/mpeg;base64,${res.audioBase64}`);
      audioRef.current = audio;
      setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      await audio.play().catch(() => setSpeaking(false));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="serif text-xl">Talk by the fire</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          <div className="relative">
            <div
              className={`absolute inset-0 rounded-full bg-primary/25 blur-xl transition-opacity ${
                recording || speaking ? "opacity-100 animate-pulse" : "opacity-0"
              }`}
            />
            <Button
              type="button"
              size="icon"
              disabled={busy}
              onClick={recording ? stopRecording : startRecording}
              className="relative h-24 w-24 rounded-full"
            >
              {busy ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : recording ? (
                <Square className="h-7 w-7" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground italic text-center min-h-5">
            {busy
              ? "listening back…"
              : speaking
                ? "…speaking"
                : recording
                  ? "I'm here. Tap when you're done."
                  : "Tap to speak."}
          </p>

          <div className="w-full max-h-56 overflow-y-auto space-y-2">
            {turns.slice(-8).map((t, i) => (
              <div
                key={i}
                className={`text-sm rounded-2xl px-3 py-2 ${
                  t.role === "user" ? "bg-primary/10 ml-8" : "bg-card warm-border mr-8"
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
