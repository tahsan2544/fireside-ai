import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, getSiteSettings } from "@/lib/hearth.functions";
import { supabase } from "@/integrations/supabase/client";
import { DISCLAIMER } from "@/lib/safety";
import {
  Flame,
  MessageCircle,
  Users,
  NotebookPen,
  Settings as SettingsIcon,
  ShieldCheck,
  Brain,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ReactNode } from "react";

export const ADMIN_EMAIL = "tarifulislam2544@gmail.com";

const primary = [
  { to: "/hearth", label: "Hearth", icon: MessageCircle },
  { to: "/journal", label: "Journal", icon: NotebookPen },
  { to: "/commons", label: "Commons", icon: Users },
  { to: "/memory", label: "Memories", icon: Brain },
] as const;

const secondary = [
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/help", label: "Help", icon: LifeBuoy },
] as const;

export function useMe() {
  const getMeFn = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
}

export function useSiteSettings() {
  const fn = useServerFn(getSiteSettings);
  return useQuery({ queryKey: ["site-settings"], queryFn: () => fn(), staleTime: 60_000 });
}

export function useIsAdmin() {
  const me = useMe();
  return !!me.data && (me.data.isAdmin || me.data.email?.toLowerCase() === ADMIN_EMAIL);
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const site = useSiteSettings();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isAdmin = !!me.data && (me.data.isAdmin || me.data.email?.toLowerCase() === ADMIN_EMAIL);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/85 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="mr-3 flex shrink-0 items-center gap-2">
            <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="serif text-base">{site.data?.site_name ?? "Fireside"}</span>
          </Link>

          <div className="hidden items-center gap-1 sm:flex">
            {primary.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeProps={{ className: "text-foreground bg-accent/50" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            {secondary.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeProps={{ className: "text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="hidden rounded-md px-2.5 py-1.5 text-xs transition-colors hover:text-foreground sm:inline-flex"
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-primary hover:bg-accent/50"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Admin
              </Link>
            )}
            <ThemeToggle />
            <button
              onClick={signOut}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </nav>
        {site.data?.announcement ? (
          <div className="border-t border-border/50 bg-accent/30 px-5 py-2 text-center text-xs text-accent-foreground">
            {site.data.announcement}
          </div>
        ) : null}
      </header>

      <div className="flex-1 pb-16 sm:pb-0">{children}</div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border/60 bg-background/95 backdrop-blur sm:hidden"
      >
        {[...primary, secondary[0]].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px]"
          >
            <l.icon className="h-5 w-5" aria-hidden="true" />
            {l.label}
          </Link>
        ))}
      </nav>

      <footer className="hidden border-t border-border/50 px-5 py-4 text-center text-[11px] text-muted-foreground sm:block">
        {DISCLAIMER}{" "}
        <Link to="/pricing" className="text-primary hover:underline">
          Plans
        </Link>
      </footer>
    </div>
  );
}
