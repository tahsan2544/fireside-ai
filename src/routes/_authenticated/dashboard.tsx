import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, useMe, useSiteSettings, useIsAdmin } from "@/components/AppShell";
import { MessageCircle, Users, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Fireside AI" },
      { name: "description", content: "Your fireside hub: choose the Hearth for AI, or the Commons for people." },
      { property: "og:title", content: "Dashboard — Fireside AI" },
      { property: "og:description", content: "Your fireside hub: choose the Hearth for AI, or the Commons for people." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const me = useMe();
  const site = useSiteSettings();
  const isAdmin = useIsAdmin();

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-6 py-20">
        {me.isLoading ? (
          <Skeleton className="mx-auto h-9 w-64" />
        ) : (
          <h1 className="serif text-center text-3xl text-foreground">
            Good to see you, {me.data?.displayName ?? "friend"}.
          </h1>
        )}
        <p className="mt-3 text-center text-sm italic text-muted-foreground">
          {site.data?.welcome_note ?? "Nothing to finish here. Just somewhere to sit."}
        </p>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          <Link
            to="/hearth"
            className="group rounded-2xl border border-border/60 bg-card p-8 transition-colors hover:border-primary/50"
          >
            <MessageCircle className="mb-5 h-6 w-6 text-primary" />
            <h2 className="serif text-xl">Go to The Hearth</h2>
            <p className="mt-2 text-sm text-muted-foreground">Talk to AI. Quietly, for as long as you like.</p>
          </Link>

          <Link
            to="/commons"
            className="group rounded-2xl border border-border/60 bg-card p-8 transition-colors hover:border-primary/50"
          >
            <Users className="mb-5 h-6 w-6 text-primary" />
            <h2 className="serif text-xl">Go to The Commons</h2>
            <p className="mt-2 text-sm text-muted-foreground">Talk to others who are sitting by the fire right now.</p>
          </Link>
        </div>

        {isAdmin && (
          <Link
            to="/admin"
            className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-6 transition-colors hover:border-primary"
          >
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h2 className="serif text-lg">The Library — Admin</h2>
              <p className="text-sm text-muted-foreground">People, activity, moderation and every site setting.</p>
            </div>
          </Link>
        )}
      </main>
    </AppShell>
  );
}
