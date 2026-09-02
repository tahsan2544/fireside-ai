import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "in">("checking");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        navigate({ to: "/", replace: true });
        return;
      }
      setState("in");
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (state === "checking") {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return <Outlet />;
}
