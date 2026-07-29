import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminOverview, adminListUsers, adminToggleSuspend, getMe } from "@/lib/hearth.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
});

function Admin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const overviewFn = useServerFn(adminOverview);
  const usersFn = useServerFn(adminListUsers);
  const suspendFn = useServerFn(adminToggleSuspend);

  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => overviewFn(), enabled: !!me.data?.isAdmin });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn(), enabled: !!me.data?.isAdmin });

  useEffect(() => {
    if (me.data && !me.data.isAdmin) navigate({ to: "/dashboard" });
  }, [me.data, navigate]);

  const suspend = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) => suspendFn({ data: { userId: id, suspended } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });


  if (!me.data?.isAdmin) return <div className="p-8 text-center text-muted-foreground">Checking…</div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-card/50">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to hearth
          </Link>
          <h1 className="serif text-xl">The Library</h1>
          <div className="text-xs text-muted-foreground">admin</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {/* Stats */}
        <section>
          <h2 className="serif text-2xl mb-4">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total users", value: overview.data?.totalUsers },
              { label: "Active today", value: overview.data?.activeUsersToday },
              { label: "Total conversations", value: overview.data?.totalConversations },
              { label: "Total messages", value: overview.data?.totalMessages },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-card warm-border p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="serif text-3xl mt-1">{s.value ?? "…"}</p>
              </div>
            ))}
          </div>
        </section>



        {/* Users */}
        <section>
          <h2 className="serif text-2xl mb-4">Users</h2>
          <div className="overflow-x-auto rounded-xl bg-card warm-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Joined</th>
                  <th className="text-right p-3">Rooms</th>
                  <th className="text-right p-3">Today</th>
                  <th className="text-left p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => (
                  <tr key={u.id} className="border-b border-border/40 last:border-0">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.displayName}</td>
                    <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">{u.conversationCount}</td>
                    <td className="p-3 text-right">{u.messagesToday}</td>
                    <td className="p-3">
                      {u.suspended ? <span className="text-destructive">suspended</span> : <span className="text-muted-foreground">active</span>}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => suspend.mutate({ id: u.id, suspended: !u.suspended })}>
                        {u.suspended ? "Unsuspend" : "Suspend"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.isLoading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
