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
      { title: "Fireside AI — A calm AI companion to talk with" },
      {
        name: "description",
        content:
          "Fireside AI is a quiet AI companion. Talk one-to-one at the Hearth, sit with others in the Commons, and keep a private journal.",
      },
      { property: "og:title", content: "Fireside AI — A calm AI companion to talk with" },
      {
        property: "og:description",
        content: "Talk one-to-one with a gentle AI at the Hearth, or sit with others in the Commons.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fireside-ai.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://fireside-ai.lovable.app/" }],
  }),

  component: Threshold,
});


function Threshold() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
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
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error("Could not sign in with Google");
    if (!result.redirected) navigate({ to: "/dashboard" });
  };

  return (
    <main className="relative min-h-screen bg-background px-6 py-16">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-10 text-center">
          <Flame className="mx-auto mb-6 h-7 w-7 text-primary" aria-hidden="true" />
          <h1 className="serif text-3xl leading-snug text-foreground">
            Fireside AI — a quiet place.
            <br />A warm voice.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            A calm AI companion for the end of the day. Talk it through, or just sit for a while.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name" className="text-xs text-muted-foreground">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="What we'll call you" />
            </div>
          )}
          <div>
            <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Signing in" /> : mode === "signin" ? "Sign In" : "Sign Up"}
          </Button>
        </form>

        <Button type="button" variant="outline" onClick={google} className="mt-3 w-full rounded-full">
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary hover:underline">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>

      <section className="mx-auto mt-20 max-w-2xl space-y-10 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="serif text-xl text-foreground">What Fireside AI is</h2>
          <p className="mt-3">
            Fireside AI is an AI companion built for presence rather than productivity. There are no streaks, no
            dashboards of progress, no nudges to come back. You open it when you want to talk, say what's on your mind
            in plain words, and get a gentle, unhurried reply. Everything you write stays private to your account.
          </p>
        </div>

        <div>
          <h2 className="serif text-xl text-foreground">The Hearth — private conversation with an AI</h2>
          <p className="mt-3">
            The Hearth is a one-to-one room with a warm, brief AI companion. It remembers the things you ask it to
            remember — your name, what you're working through, what helps on a hard day — and you can read, edit or
            erase those memories at any time. You can talk by typing, speak out loud with voice, or share a photo or a
            document and have it read along with you.
          </p>
        </div>

        <div>
          <h2 className="serif text-xl text-foreground">The Commons — sit with other people</h2>
          <p className="mt-3">
            The Commons is a real-time room for people, not bots. You can see who is sitting by the fire right now,
            join a Quiet Room when you'd rather listen than talk, and step out whenever you like. It's moderated,
            slow-paced and deliberately small.
          </p>
        </div>

        <div>
          <h2 className="serif text-xl text-foreground">A journal that reflects back</h2>
          <p className="mt-3">
            Write a few lines about your day, mark how it felt, and — only if you ask — receive a short reflection
            instead of advice. Entries are yours alone and can be exported whenever you want them elsewhere.
          </p>
        </div>

        <p className="text-xs">
          Fireside AI is a companion for everyday reflection, not therapy or crisis care. If you're in danger, please
          contact your local emergency services.
        </p>
      </section>
    </main>
  );

}
