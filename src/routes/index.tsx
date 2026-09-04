import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Flame, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fireside AI — A quiet place to put your thoughts" },
      {
        name: "description",
        content:
          "A warm AI companion for reflection, conversation, and the moments when you don't need another productivity app.",
      },
      { property: "og:title", content: "Fireside AI — A quiet place to put your thoughts" },
      {
        property: "og:description",
        content: "A warm AI companion for reflection, conversation, and quiet evenings.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fireside-ai.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://fireside-ai.lovable.app/" }],
  }),

  component: Threshold,
});

const SITE_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Fireside AI",
  url: "https://fireside-ai.lovable.app/",
  description:
    "A calm AI companion: private conversation at the Hearth, shared rooms in the Commons, and a reflective journal.",
});

const ORG_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Fireside AI",
  url: "https://fireside-ai.lovable.app/",
  logo: "https://fireside-ai.lovable.app/favicon.ico",
});

function HearthVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="surface-2 warm-border paper relative overflow-hidden rounded-xl p-6">
        <div className="ambient pointer-events-none absolute -bottom-24 left-1/2 h-56 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--flame),transparent_70%)] opacity-40 blur-2xl" />
        <div className="relative space-y-3">
          <div className="ml-auto w-2/3 rounded-lg rounded-br-sm bg-primary/15 px-4 py-3 text-sm text-foreground">
            Long day. Thinking out loud for a minute.
          </div>
          <div className="w-3/4 rounded-lg rounded-bl-sm bg-muted px-4 py-3 text-sm text-muted-foreground">
            Go ahead. What's still on your mind?
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Say something…
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Sit down", body: "Open the Hearth and start wherever you are. No setup, no prompts to master." },
  { title: "Say what you like", body: "Type, speak, or share a photo or document. Fireside answers plainly." },
  { title: "Keep what matters", body: "Ask Fireside to remember something, or leave a few words in the Journal." },
];

function Threshold() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hearth", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome. Pull up a chair.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/hearth" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something didn't come through. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error("Could not sign in with Google");
    if (!result.redirected) navigate({ to: "/hearth" });
  };

  return (
    <main className="relative min-h-dvh bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_JSONLD }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORG_JSONLD }} />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-24">
        <div className="hearth-glow-soft pointer-events-none absolute inset-x-0 bottom-0 h-96" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-primary">Fireside AI</p>
            <h1 className="serif mt-5 text-4xl leading-[1.12] text-foreground sm:text-5xl">
              A quiet place to put your thoughts.
            </h1>
            <p className="reading mt-5 text-base text-muted-foreground">
              A warm AI companion for reflection, conversation, and the moments when you don't need another
              productivity app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild={false} className="rounded-full px-6" onClick={() => {
                setMode("signup");
                document.getElementById("enter")?.scrollIntoView({ behavior: "smooth" });
              }}>
                Enter the Hearth
              </Button>
              <Button
                variant="ghost"
                className="rounded-full px-5 text-muted-foreground"
                onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              >
                See how it works
              </Button>
            </div>
          </div>
          <HearthVisual />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="serif text-2xl">How it works</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <article key={s.title}>
                <p className="serif text-sm text-primary">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="serif mt-2 text-lg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-10 max-w-xl text-xs text-muted-foreground">
            Fireside is for conversation and reflection, not therapy or emergency care.
          </p>
        </div>
      </section>

      {/* Auth */}
      <section id="enter" className="border-t border-border/50 px-6 py-20">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="serif text-2xl">
            {mode === "signin" ? "Welcome back to the Hearth." : "Make yourself a little room."}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin" ? "Sign in and pick up where you left off." : "An email and a password is all it takes."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name" className="text-xs text-muted-foreground">
                  What should Fireside call you?
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                  placeholder="Optional"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-label="Working" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create a room"
              )}
            </Button>
          </form>

          <Button type="button" variant="outline" className="mt-3 w-full rounded-full" onClick={google}>
            Continue with Google
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "New here? Make yourself a little room." : "Already have a room? Sign in."}
          </button>
        </div>
      </section>

      <footer className="border-t border-border/50 px-6 py-8 text-center text-xs text-muted-foreground">
        Fireside is for conversation and reflection, not therapy or emergency care.{" "}
        <a href="/help" className="text-primary hover:underline">
          Help &amp; guidelines
        </a>
      </footer>
    </main>
  );
}
