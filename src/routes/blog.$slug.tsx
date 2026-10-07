import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { getPublishedPost } from "@/lib/blog.functions";

const postQuery = (slug: string) =>
  queryOptions({ queryKey: ["blog", "post", slug], queryFn: () => getPublishedPost({ data: { slug } }) });

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const post = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.post ? `${loaderData.post.title} — Fireside AI` : "Reflection — Fireside AI";
    const desc = loaderData?.post?.excerpt || "A quiet reflection from the Fireside.";
    const url = `https://fireside-ai.lovable.app/blog/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <p className="p-10 text-center text-muted-foreground">This reflection couldn't be loaded.</p>,
  notFoundComponent: () => (
    <div className="p-16 text-center">
      <p className="text-muted-foreground">This reflection isn't here.</p>
      <Link to="/blog" className="mt-4 inline-block text-primary hover:underline">All reflections</Link>
    </div>
  ),
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data: post } = useSuspenseQuery(postQuery(slug));
  if (!post) return null;
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-16">
      <Link to="/blog" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All reflections
      </Link>
      <article className="settle-in">
        {post.published_at && (
          <time className="text-xs uppercase tracking-wider text-muted-foreground">
            {new Date(post.published_at).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          </time>
        )}
        <h1 className="serif mt-2 text-4xl leading-tight text-foreground sm:text-5xl">{post.title}</h1>
        <div className="mt-10 space-y-5 text-lg leading-relaxed text-foreground/90">
          {post.body.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line">{para}</p>
          ))}
        </div>
      </article>
    </main>
  );
}
