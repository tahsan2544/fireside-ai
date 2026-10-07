import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useIsAdmin, useMe } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/write")({
  head: () => ({
    meta: [
      { title: "Write a reflection — Fireside AI" },
      { name: "description", content: "Write and publish quiet reflections." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WritePage,
});

type Draft = { id?: string; title: string; slug: string; excerpt: string; body: string; published: boolean };
const empty: Draft = { title: "", slug: "", excerpt: "", body: "", published: false };
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

function WritePage() {
  const me = useMe();
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(empty);

  const posts = useQuery({
    queryKey: ["blog", "mine"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, body, published, published_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Please sign in again.");
      const slug = slugify(draft.slug || draft.title);
      if (!draft.title.trim() || !slug) throw new Error("Give it a title first.");
      const existing = posts.data?.find((p) => p.id === draft.id);
      const row = {
        title: draft.title.trim(),
        slug,
        excerpt: draft.excerpt.trim(),
        body: draft.body,
        published: publish,
        published_at: publish ? (existing?.published_at ?? new Date().toISOString()) : existing?.published_at ?? null,
      };
      const res = draft.id
        ? await supabase.from("blog_posts").update(row).eq("id", draft.id).select("id").single()
        : await supabase.from("blog_posts").insert({ ...row, author_id: u.user.id }).select("id").single();
      if (res.error) throw new Error(res.error.code === "23505" ? "That link is already used by another post." : res.error.message);
      return { id: res.data.id, publish, slug };
    },
    onSuccess: ({ id, publish, slug }) => {
      setDraft((d) => ({ ...d, id, slug, published: publish }));
      qc.invalidateQueries({ queryKey: ["blog"] });
      toast.success(publish ? "Published." : "Saved as a draft.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(empty);
      qc.invalidateQueries({ queryKey: ["blog"] });
      toast.success("Deleted.");
    },
  });

  if (me.isLoading) return <AppShell><div className="p-10" aria-busy="true" /></AppShell>;
  if (!isAdmin)
    return (
      <AppShell>
        <p className="p-16 text-center text-muted-foreground">Only the keeper of this fire can write reflections.</p>
      </AppShell>
    );

  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppShell>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Your reflections</h2>
            <button onClick={() => setDraft(empty)} className="text-xs text-primary hover:underline">New</button>
          </div>
          <ul className="space-y-1">
            {posts.data?.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setDraft({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, body: p.body, published: p.published })}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/50 ${draft.id === p.id ? "bg-accent/50" : ""}`}
                >
                  <span className="block truncate text-foreground">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.published ? "Published" : "Draft"}</span>
                </button>
              </li>
            ))}
            {posts.data?.length === 0 && <li className="text-xs text-muted-foreground">Nothing yet.</li>}
          </ul>
          <Link to="/blog" className="mt-6 inline-block text-xs text-primary hover:underline">View the public page</Link>
        </aside>

        <section className="space-y-4">
          <h1 className="serif text-3xl text-foreground">{draft.id ? "Edit reflection" : "A new reflection"}</h1>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Title</span>
            <input className={field} value={draft.title} maxLength={160} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Link (leave empty to use the title)</span>
            <input className={field} value={draft.slug} maxLength={80} placeholder={slugify(draft.title)} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Short summary</span>
            <input className={field} value={draft.excerpt} maxLength={300} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Words</span>
            <textarea className={`${field} serif min-h-[360px] text-base leading-relaxed`} value={draft.body} maxLength={50000} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button disabled={save.isPending} onClick={() => save.mutate(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {draft.published ? "Update" : "Publish"}
            </button>
            <button disabled={save.isPending} onClick={() => save.mutate(false)} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent disabled:opacity-60">
              {draft.published ? "Unpublish" : "Save draft"}
            </button>
            {draft.id && (
              <button
                onClick={() => confirm("Delete this reflection for good?") && remove.mutate(draft.id!)}
                className="ml-auto rounded-md px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
