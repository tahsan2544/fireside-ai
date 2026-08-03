import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://fireside-ai.lovable.app";
const PAGES = [
  { path: "/", priority: "1.0", freq: "weekly" },
  { path: "/auth", priority: "0.6", freq: "monthly" },
  { path: "/pricing", priority: "0.8", freq: "monthly" },
];

export const Route = createFileRoute("/sitemap[.]xml")({
  server: {
    handlers: {
      GET: () => {
        const today = new Date().toISOString().slice(0, 10);
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(
  (p) =>
    `  <url><loc>${BASE}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`
).join("\n")}
</urlset>`;
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
