import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { updatePrefs } from "@/lib/fireside.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Feather, Flame, Loader2, MessageCircle, Moon, Sparkles, Users } from "lucide-react";
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
  { label: "Talking things through", icon: MessageCircle },
  { label: "Reflecting", icon: Moon },
  { label: "Journaling", icon: Feather },
  { label: "Sitting with others", icon: Users },
  { label: "A little of everything", icon: Sparkles },
] as const;

const STEPS = 4;

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-all duration-300 ${
        active
          ? "border-primary bg-primary/10 text-foreground shadow-[0_8px_24px_-12px_var(--color-primary)]"
          : "border-border/70 bg-card/40 text-muted-foreground hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {children}
      <span
        className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
          active ? "scale-100 border-primary bg-primary text-primary-foreground" : "scale-90 border-border"
        }`}
        aria-hidden="true"
      >
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

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
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/hearth", replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Something didn't come through. Try again."),
  });

  const skip = () => {
    window.localStorage.setItem(ONBOARDED_KEY, "1");
    navigate({ to: "/hearth", replace: true });
  };

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish.mutate());

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-16">
      <div className="hearth-glow-soft ambient pointer-events-none absolute inset-x-0 bottom-0 h-96" aria-hidden="true" />
      <div className="relative w-full max-w-xl">
        <div className="mb-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-primary" aria-hidden="true" /> Fireside
          </span>
          <button type="button" onClick={skip} className="text-xs text-muted-foreground hover:text-foreground">
            Skip for now
          </button>
        </div>

        <div className="mb-8 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label="Welcome progress">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-border/60">
              <span
                className="block h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: i <= step ? "100%" : "0%" }}
              />
            </span>
          ))}
        </div>

        <div key={step} className="settle">
          {step === 0 && (
            <section aria-labelledby="ob-0" className="text-center">
              <div className="hearth mx-auto scale-75" aria-hidden="true">
                <div className="hearth-frame">
                  <div className="hearth-glow" />
                  <div className="hearth-flame f1" />
                  <div className="hearth-flame f2" />
                  <div className="hearth-flame f3" />
                  <div className="hearth-logs" />
                  <span className="ember" /><span className="ember" /><span className="ember" /><span className="ember" />
                </div>
              </div>
              <h1 id="ob-0" className="serif mt-2 text-4xl">The fire is already lit.</h1>
              <p className="reading mx-auto mt-4 text-sm text-muted-foreground">
                Three small questions, then you're in. Every one is optional — there are no wrong answers and nothing is
                locked in.
              </p>
            </section>
          )}

          {step === 1 && (
            <section aria-labelledby="ob-1">
              <h1 id="ob-1" className="serif text-3xl">What would you like Fireside to be for?</h1>
              <p className="mt-3 text-sm text-muted-foreground">It helps the Hearth meet you where you are.</p>
              <div className="mt-8 grid gap-2">
                {PURPOSES.map(({ label, icon: Icon }) => (
                  <Choice key={label} active={purpose === label} onClick={() => setPurpose(label)}>
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {label}
                  </Choice>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="ob-2">
              <h1 id="ob-2" className="serif text-3xl">What should Fireside call you?</h1>
              <p className="mt-3 text-sm text-muted-foreground">A first name, a nickname, or nothing at all.</p>
              <div className="mt-8">
                <Label htmlFor="ob-name" className="text-xs text-muted-foreground">Name</Label>
                <Input
                  id="ob-name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  maxLength={40}
                  className="mt-1 h-12 rounded-xl text-base"
                  placeholder="Optional"
                />
                {name.trim() && (
                  <p className="settle serif mt-6 text-lg text-muted-foreground">
                    Good to have you here, <span className="text-foreground">{name.trim()}</span>.
                  </p>
                )}
              </div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="ob-3">
              <h1 id="ob-3" className="serif text-3xl">Should Fireside remember things?</h1>
              <p className="reading mt-3 text-sm text-muted-foreground">
                Small things you share — a name, what you're working on — can be kept so you don't have to repeat
                yourself. Every memory is listed on the Memories page, where you can edit, delete, or clear them all.
              </p>
              <div className="mt-8 grid gap-2">
                <Choice active={memory === true} onClick={() => setMemory(true)}>Yes, remember what matters</Choice>
                <Choice active={memory === false} onClick={() => setMemory(false)}>No, keep nothing</Choice>
              </div>
            </section>
          )}
        </div>

        <div className="mt-10 flex items-center gap-3">
          {step > 0 && (
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Back" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Button className="ml-auto rounded-full px-7" disabled={finish.isPending} onClick={next}>
            {finish.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />
            ) : step === 0 ? (
              "Begin"
            ) : step < STEPS - 1 ? (
              "Continue"
            ) : (
              "Step inside"
            )}
          </Button>
        </div>
        <p className="mt-8 text-center text-[11px] text-muted-foreground">Under a minute · change anything later in Settings</p>
      </div>
    </main>
  );
}
