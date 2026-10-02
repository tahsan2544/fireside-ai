import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Brain, Flame, Lock, Mic, Paperclip, ShieldCheck, Users } from "lucide-react";
import { DISCLAIMER } from "@/lib/safety";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & guidelines — Fireside AI" },
      {
        name: "description",
        content:
          "How Fireside works: the Hearth, Journal, Commons and Memories, plus privacy, boundaries, FAQs and community guidelines.",
      },
      { property: "og:title", content: "Help & guidelines — Fireside AI" },
      { property: "og:description", content: "How Fireside works, what it remembers, and where to find real-world support." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fireside-ai.lovable.app/help" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://fireside-ai.lovable.app/help" }],
  }),
  component: HelpPage,
});

const SECTIONS = [
  { icon: Flame, title: "The Hearth", body: "A private one-to-one conversation. Replies appear as they're written. Nothing you say here is shown to anyone else." },
  { icon: Mic, title: "Voice", body: "Tap the microphone to talk out loud. Fireside listens, answers in a warm voice, and keeps a written record in the room." },
  { icon: Paperclip, title: "Photos & documents", body: "Share a photo or a document and talk about it. You can also ask the Hearth to draw a picture or write a document for you." },
  { icon: BookOpen, title: "The Journal", body: "Leave a few words about the day. Ask for a gentle reflection on an entry only when you want one." },
  { icon: Users, title: "The Commons", body: "Small shared rooms with other people. Talk, listen, or simply sit. Quiet Rooms are for sitting without conversation." },
  { icon: Brain, title: "Memories", body: "Small things you share can be kept so you don't repeat yourself. Every memory can be edited or deleted, or cleared at once." },
];

const FAQ = [
  { q: "Is Fireside a therapist?", a: "No. Fireside is a calm companion for thinking out loud. It is not medical, legal or mental-health care, and it will point you toward real people when that's what's needed." },
  { q: "Who can read my conversations?", a: "Only you. Hearth rooms, journal entries and memories belong to your account. Messages you write in the Commons are visible to people in that room." },
  { q: "How do I delete a room?", a: "Open the room list on the Hearth, choose the room, and use the delete option. Deleting a room removes its messages for good." },
  { q: "How do I stop Fireside remembering things?", a: "Turn off “Let Fireside remember” on the Memories page or in Settings. You can also delete individual memories or forget everything." },
  { q: "Are there limits?", a: "Free accounts have a gentle daily allowance for messages and voice. The allowance resets each day — there are no streaks or penalties." },
  { q: "Can I switch between light and dark?", a: "Yes. Use the sun / moon button in the top bar. Fireside starts in light and remembers your choice." },
  { q: "Something isn't working.", a: "Refresh the page first. If a reply stops halfway, send your message again — nothing you've written is lost." },
];

const PRIVACY = [
  "Your conversations belong to your account. Other people cannot read them.",
  "Memories are editable and removable at any time.",
  "Turning memory off means nothing new is kept.",
  "Anything you write in the Commons is visible to people in that room.",
];

function HelpPage() {
  return (
    <main className="relative mx-auto max-w-4xl px-6 py-16">
      <div className="hearth-glow-soft ambient pointer-events-none absolute inset-x-0 top-0 h-64 rotate-180" aria-hidden="true" />
      <header className="relative text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Help</p>
        <h1 className="serif mt-3 text-4xl sm:text-5xl">How Fireside works</h1>
        <p className="reading mx-auto mt-5 text-sm text-muted-foreground">
          Fireside is a quiet place to think out loud. There's nothing to keep up with here — no streaks, no scores, no
          reason to come back other than wanting to.
        </p>
      </header>

      <section aria-labelledby="rooms" className="mt-14">
        <h2 id="rooms" className="sr-only">Places in Fireside</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map(({ icon: Icon, title, body }, i) => (
            <article key={title} className="settle surface-2 warm-border rounded-xl p-5" style={{ animationDelay: `${i * 70}ms` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="serif mt-4 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-16">
        <h2 id="faq" className="serif text-2xl">Questions people ask</h2>
        <Accordion type="single" collapsible className="mt-4">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
              <AccordionContent className="reading text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <div className="mt-16 grid gap-6 md:grid-cols-2">
        <section aria-labelledby="privacy" className="surface-1 rounded-xl border border-border/60 p-6">
          <h2 id="privacy" className="serif flex items-center gap-2 text-xl">
            <Lock className="h-4 w-4 text-primary" aria-hidden="true" /> Privacy
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {PRIVACY.map((p) => (
              <li key={p} className="flex gap-2"><span aria-hidden="true" className="text-primary">·</span><span>{p}</span></li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="community" className="surface-1 rounded-xl border border-border/60 p-6">
          <h2 id="community" className="serif flex items-center gap-2 text-xl">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Community guidelines
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            The Commons works because people are careful with each other. Don't share other people's private details,
            don't push someone who'd rather sit quietly, and use the report control if a room stops feeling safe.
            Moderators can remove messages and accounts.
          </p>
        </section>
      </div>

      <section aria-labelledby="boundaries" className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <h2 id="boundaries" className="serif flex items-center gap-2 text-xl">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Boundaries & real-world help
        </h2>
        <p className="reading mt-3 text-sm text-muted-foreground">{DISCLAIMER}</p>
        <p className="reading mt-3 text-sm text-muted-foreground">
          If you are in immediate danger, contact your local emergency number. In the US you can call or text 988; in
          the UK and Ireland, Samaritans are on 116 123. Fireside will point you toward real people rather than trying to
          handle an emergency itself.
        </p>
      </section>

      <p className="mt-14 text-center text-sm">
        <Link to="/" className="story-link text-primary">Back to Fireside</Link>
      </p>
    </main>
  );
}
