import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, getSiteSettings } from "@/lib/hearth.functions";
import { supabase } from "@/integrations/supabase/client";
import { DISCLAIMER } from "@/lib/safety";
import {
  Flame,
  LayoutGrid,
  MessageCircle,
  Users,
  NotebookPen,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";

export const ADMIN_EMAIL = "tarifulislam2544@gmail.com";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/hearth", label: "The Hearth", icon: MessageCircle },
  { to: "/commons", label: "The Commons", icon: Users },
  { to: "/journal", label: "Journal", icon: NotebookPen },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-2 px-5 py-3">
          <Link to="/dashboard" className="mr-4 flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            <span className="serif text-base">{site.data?.site_name ?? "Fireside"}</span>
          </Link>

          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "text-foreground bg-accent/60" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="rounded-full px-3 py-1.5 text-xs transition-colors hover:text-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <l.icon className="h-3.5 w-3.5" />
                {l.label}
              </span>
            </Link>
          ))}

          {isAdmin && (
            <Link
              to="/admin"
              activeProps={{ className: "bg-accent/60" }}
              className="rounded-full px-3 py-1.5 text-xs text-primary transition-colors hover:bg-accent/60"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </span>
            </Link>
          )}

          <button
            onClick={signOut}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </nav>
        {site.data?.announcement ? (
          <div className="border-t border-border/60 bg-accent/40 px-5 py-2 text-center text-xs text-accent-foreground">
            {site.data.announcement}
          </div>
        ) : null}
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border/50 px-5 py-4 text-center text-[11px] text-muted-foreground">
        {DISCLAIMER}{" "}
        <Link to="/pricing" className="text-primary hover:underline">
          Plans
        </Link>
      </footer>
    </div>
  );
}
