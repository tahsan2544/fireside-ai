import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — Fireside AI" },
    { name: "description", content: "Sign in to Fireside AI." },
    { property: "og:title", content: "Sign in — Fireside AI" },
    { property: "og:description", content: "Sign in to Fireside AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
