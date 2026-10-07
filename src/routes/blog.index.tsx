import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { listPublishedPosts } from "@/lib/blog.functions";

const postsQuery = queryOptions({ queryKey: ["blog", "list"], queryFn: () => listPublishedPosts() });

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Reflections — Fireside AI" },
      { name: "description", content: "Quiet reflections from the Fireside: short writing on rest, presence, and slower evenings." },
      { property: "og:title", content: "Reflections — Fireside AI" },
      { property: "og:description", content: "Short, quiet writing from the Fireside." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fireside-ai.lovable.app/blog" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://fireside-ai.lovable.app/blog" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQuery),
  errorComponent: () => <p className="p-10 text-center text-muted-foreground">The reflections couldn't be loaded. Try again shortly.</p>,
  notFoundComponent: () => <p className="p-10 text-center text-muted-foreground">Nothing here.</p>,
  component: BlogIndex,
});

export function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" }) : "";
}

function BlogIndex() {
  const { data: posts } = useSuspenseQuery(postsQuery);
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-16">
      <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <Flame className="h-4 w-4 text-primary" aria-hidden="true" /> Fireside
      </Link>
      <h1 className="serif text-4xl text-foreground sm:text-5xl">Reflections</h1>
      <p className="mt-3 text-muted-foreground">Short, quiet writing from beside the fire.</p>
      {posts.length === 0 ? (
        <p className="mt-16 text-center text-muted-foreground">Nothing written yet. The first reflection is still warming up.</p>
      ) : (
        <ul className="mt-12 space-y-10">
          {posts.map((p) => (
            <li key={p.slug} className="settle-in">
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="group block">
                <time className="text-xs uppercase tracking-wider text-muted-foreground">{formatDate(p.published_at)}</time>
                <h2 className="serif mt-1 text-2xl text-foreground transition-colors group-hover:text-primary">{p.title}</h2>
                {p.excerpt && <p className="mt-2 text-muted-foreground">{p.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
