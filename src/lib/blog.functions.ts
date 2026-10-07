import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  published_at: string | null;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await publicClient();
  const { data, error } = await sb
    .from("blog_posts")
    .select("slug, title, excerpt, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Couldn't load reflections.");
  return (data ?? []) as Omit<BlogPost, "body">[];
});

export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await publicClient();
    const { data: post } = await sb
      .from("blog_posts")
      .select("slug, title, excerpt, body, published_at")
      .eq("published", true)
      .eq("slug", data.slug)
      .maybeSingle();
    return (post ?? null) as BlogPost | null;
  });
