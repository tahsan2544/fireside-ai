import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://fireside-ai.lovable.app";
const PAGES = [
  { path: "/", priority: "1.0", freq: "weekly" },
  { path: "/blog", priority: "0.8", freq: "weekly" },
  { path: "/pricing", priority: "0.8", freq: "monthly" },
  { path: "/help", priority: "0.6", freq: "monthly" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let posts: { slug: string; updated_at: string }[] = [];
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { data } = await sb.from("blog_posts").select("slug, updated_at").eq("published", true).limit(1000);
          posts = data ?? [];
        } catch {
          /* static pages still listed */
        }
        const urls = [
          ...PAGES.map(
            (p) => `  <url><loc>${BASE}${p.path}</loc><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`
          ),
          ...posts.map(
            (p) =>
              `  <url><loc>${BASE}/blog/${esc(p.slug)}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`
          ),
        ];
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
