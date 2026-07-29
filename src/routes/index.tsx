import { createFileRoute, Link } from "@tanstack/react-router";
import { Hearth } from "@/components/Hearth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 hearth-glow-soft" />
        <div className="mx-auto max-w-3xl px-6 pt-20 pb-16 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-8">Hearth AI</p>
          <div className="mb-10 flex justify-center"><Hearth /></div>
          <h1 className="serif text-5xl md:text-6xl leading-tight text-foreground">
            A quiet place.<br />A warm voice.
          </h1>
          <p className="serif mt-6 text-lg md:text-xl text-muted-foreground italic max-w-xl mx-auto">
            No tasks to complete. No productivity to measure.<br />
            Just someone to talk to, for a little while.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="rounded-full px-8 py-6 text-base shadow-lg">
              <Link to="/auth">Come In, Sit Down</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The Ritual */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="serif text-center text-3xl mb-2">The Ritual</h2>
        <p className="text-center text-sm text-muted-foreground mb-12 italic">Scarcity makes words matter.</p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { title: "Ten Conversations", body: "You can open up to 10 chat threads. Like rooms in a house, not infinite tabs." },
            { title: "Twenty Moments a Day", body: "You can send 20 messages per day. When they're gone, the fire banks for the night." },
            { title: "Nothing to Achieve", body: "No goals. No productivity. Just talking. That's the whole thing." },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl bg-card warm-border p-8">
              <h3 className="serif text-xl mb-3 text-foreground">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quote */}
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <blockquote className="serif text-2xl md:text-3xl italic text-foreground/80 leading-relaxed">
          "Sit down. Be quiet. Let the fire do the talking, or don't.<br />
          Some things don't need to be solved. They need to be sat with."
        </blockquote>
      </section>

      <footer className="border-t border-border/50 mt-8">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center text-xs text-muted-foreground">
          Made with care. Not for scale.
        </div>
      </footer>
    </div>
  );
}
