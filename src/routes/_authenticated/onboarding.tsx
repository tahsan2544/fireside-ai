import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updatePrefs } from "@/lib/fireside.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const ONBOARDED_KEY = "fireside-onboarded";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to the Hearth — Fireside AI" },
      { name: "description", content: "A short, optional welcome before your first conversation at the Hearth." },
      { property: "og:title", content: "Welcome to the Hearth — Fireside AI" },
      { property: "og:description", content: "A short, optional welcome before your first conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const PURPOSES = [
  "Talking things through",
  "Reflecting",
  "Journaling",
  "Having a quiet conversation",
  "A little of everything",
] as const;

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePrefs);

  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [memory, setMemory] = useState<boolean | null>(null);

  const finish = useMutation({
    mutationFn: async () => {
      const patch: { displayName?: string; memoryEnabled?: boolean } = {};
      if (name.trim()) patch.displayName = name.trim().slice(0, 40);
      if (memory !== null) patch.memoryEnabled = memory;
      if (Object.keys(patch).length) await updateFn({ data: patch });
      if (purpose) window.localStorage.setItem("fireside-purpose", purpose);
    },
    onSuccess: () => {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
      qc.invalidateQueries({ queryKey: ["prefs"] });
      navigate({ to: "/hearth", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Something didn't come through. Try again."),
  });

  const skip = () => {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
    navigate({ to: "/hearth", replace: true });
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div className="hearth-glow-soft pointer-events-none absolute inset-x-0 bottom-0 h-72" aria-hidden="true" />
      <div className="settle relative">
        <Flame className="mb-6 h-5 w-5 text-primary" aria-hidden="true" />

        {step === 0 && (
          <section aria-labelledby="step1">
            <h1 id="step1" className="serif text-3xl">
              What would you like Fireside to be for?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">You can change your mind later. Nothing is locked in.</p>
            <div className="mt-8 grid gap-2">
              {PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  aria-pressed={purpose === p}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    purpose === p
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="step2">
            <h1 id="step2" className="serif text-3xl">
              What should Fireside call you?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">Optional. A first name, a nickname, or nothing at all.</p>
            <div className="mt-8">
              <Label htmlFor="ob-name" className="text-xs text-muted-foreground">
                Name
              </Label>
              <Input
                id="ob-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="mt-1"
                placeholder="Optional"
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="step3">
            <h1 id="step3" className="serif text-3xl">
              Should Fireside remember things you ask it to?
            </h1>
            <p className="reading mt-3 text-sm text-muted-foreground">
              Fireside only keeps something when you ask it to keep it. Every memory is listed on the Memories page,
              where you can edit or delete any of them, or clear them all at once.
            </p>
            <div className="mt-8 grid gap-2">
              {[
                { v: true, label: "Yes, remember what I ask" },
                { v: false, label: "No, keep nothing" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setMemory(o.v)}
                  aria-pressed={memory === o.v}
                  className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    memory === o.v
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 flex items-center gap-3">
          {step < 2 ? (
            <Button className="rounded-full px-6" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button className="rounded-full px-6" disabled={finish.isPending} onClick={() => finish.mutate()}>
              {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" /> : "Welcome to the Hearth"}
            </Button>
          )}
          <button type="button" onClick={skip} className="text-xs text-muted-foreground hover:text-foreground">
            Skip
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          )}
        </div>
        <p className="mt-8 text-[11px] text-muted-foreground">Step {step + 1} of 3 · under a minute</p>
      </div>
    </main>
  );
}
