import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Flame } from "lucide-react";
import { DISCLAIMER } from "@/lib/safety";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Plans — Fireside AI" },
      {
        name: "description",
        content:
          "Fireside is free to sit by. Warm Ember adds unlimited talking, voice, and deeper memory — no pressure, no nudges.",
      },
      { property: "og:title", content: "Plans — Fireside AI" },
      {
        property: "og:description",
        content: "Free to sit by the fire. Warm Ember adds unlimited talking, voice and deeper memory.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fireside-ai.lovable.app/pricing" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://fireside-ai.lovable.app/pricing" }],
  }),


  component: Pricing,
});

const FREE = [
  "Unlimited time in the Commons",
  "30 messages a day at the Hearth",
  "5 minutes of voice a day",
  "The journal, mood and gentle reflections",
  "Everything Fireside remembers, editable",
];

const WARM = [
  "Unlimited messages at the Hearth",
  "Unlimited voice, all calm voices",
  "Deeper, longer-lived memory",
  "Quiet Rooms in the Commons",
  "Priority when the fire is busy",
];

const PRODUCT_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Fireside AI — Warm Ember",
  description:
    "Unlimited conversation at the Hearth, unlimited voice, deeper memory and Quiet Rooms in the Commons.",
  brand: { "@type": "Brand", name: "Fireside AI" },
  url: "https://fireside-ai.lovable.app/pricing",
  offers: {
    "@type": "Offer",
    price: "6.00",
    priceCurrency: "GBP",
    availability: "https://schema.org/PreOrder",
    url: "https://fireside-ai.lovable.app/pricing",
  },
});

function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: PRODUCT_JSONLD }} />

      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <span className="serif text-base">Fireside</span>
        </Link>
        <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
          Step inside
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <h1 className="serif text-3xl">Plans</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Fireside is free to sit by, and it will stay that way. If you're here often, Warm Ember keeps the fire lit
          without limits. No countdowns, no nagging, cancel whenever.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border/60 bg-card p-8">
            <h2 className="serif text-xl">By the fire</h2>
            <p className="mt-1 text-sm text-muted-foreground">Free, always</p>
            <p className="mt-6 serif text-3xl">£0</p>
            <ul className="mt-6 space-y-3 text-sm">
              {FREE.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm hover:bg-accent/50"
            >
              Sit down
            </Link>
          </section>

          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-8">
            <h2 className="serif text-xl">Warm Ember</h2>
            <p className="mt-1 text-sm text-muted-foreground">For people who come back</p>
            <p className="mt-6 serif text-3xl">
              £6 <span className="text-base text-muted-foreground">/ month</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {WARM.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <p className="mt-8 rounded-full bg-accent/50 px-4 py-2 text-center text-xs text-muted-foreground">
              Warm Ember opens soon — nothing to pay yet.
            </p>
          </section>
        </div>

        <p className="mt-14 text-xs text-muted-foreground">{DISCLAIMER}</p>
      </main>
    </div>
  );
}
