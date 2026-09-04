import { createFileRoute, Link } from "@tanstack/react-router";
import { DISCLAIMER } from "@/lib/safety";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & guidelines — Fireside AI" },
      {
        name: "description",
        content:
          "How Fireside works: the Hearth, Journal, Commons and Memories, plus privacy, boundaries and community guidelines.",
      },
      { property: "og:title", content: "Help & guidelines — Fireside AI" },
      {
        property: "og:description",
        content: "How Fireside works, what it remembers, and where to find real-world support.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fireside-ai.lovable.app/help" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://fireside-ai.lovable.app/help" }],
  }),
  component: HelpPage,
});

const SECTIONS = [
  {
    title: "The Hearth",
    body: "A private one-to-one conversation. Type, speak, or share a photo or document. Nothing you say here is shown to anyone else.",
  },
  {
    title: "The Journal",
    body: "A place to leave a few words. You can note how the day felt, and ask Fireside to reflect on an entry only when you want that.",
  },
  {
    title: "The Commons",
    body: "A small shared room with other people. You can talk, listen, or simply sit. Quiet Rooms exist for sitting without conversation.",
  },
  {
    title: "Memories",
    body: "Fireside only keeps what you ask it to keep. Every memory can be edited or deleted, and you can clear all of them at once.",
  },
];

const PRIVACY = [
  "Your conversations belong to your account. Other people cannot read them.",
  "Your memories are editable and removable at any time from the Memories page.",
  "Turning memory off means nothing new is kept.",
  "Anything you write in the Commons is visible to people in that room.",
];

function HelpPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Help</p>
      <h1 className="serif mt-3 text-3xl">How Fireside works</h1>
      <p className="reading mt-4 text-sm text-muted-foreground">
        Fireside is a quiet place to think out loud. There is nothing to keep up with here — no streaks, no scores, no
        reason to come back other than wanting to.
      </p>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <article key={s.title} className="surface-2 warm-border rounded-lg p-5">
            <h2 className="serif text-lg">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="serif text-xl">Privacy</h2>
        <ul className="reading mt-3 space-y-2 text-sm text-muted-foreground">
          {PRIVACY.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden="true">—</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="serif text-xl">Community guidelines</h2>
        <p className="reading mt-3 text-sm text-muted-foreground">
          The Commons works because people are careful with each other. Don't share other people's private details,
          don't push someone who says they'd rather sit quietly, and use the report control if a room stops feeling
          safe. Moderators can remove messages and accounts.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="serif text-xl">Boundaries</h2>
        <p className="reading mt-3 text-sm text-muted-foreground">{DISCLAIMER}</p>
        <p className="reading mt-3 text-sm text-muted-foreground">
          If you are in immediate danger, contact your local emergency number or a crisis line in your country. Fireside
          will point you toward real-world help rather than trying to handle an emergency itself.
        </p>
      </section>

      <p className="mt-14 text-sm">
        <Link to="/" className="text-primary hover:underline">
          Back to Fireside
        </Link>
      </p>
    </main>
  );
}
