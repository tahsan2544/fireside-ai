import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminOverview,
  adminListUsers,
  adminToggleSuspend,
  adminDeleteUser,
  adminSeries,
  adminUserDetail,
  getMe,
} from "@/lib/hearth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AdminSiteSettings, AdminCommonsFeed } from "@/components/AdminPanels";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpDown, Search, Trash2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
  head: () => ({
    meta: [
      { title: "The Library — Hearth AI Admin" },
      { name: "description", content: "Admin overview of Hearth AI: users, rooms, messages and activity trends." },
      { property: "og:title", content: "The Library — Hearth AI Admin" },
      { property: "og:description", content: "Admin overview of Hearth AI: users, rooms, messages and activity trends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SortKey = "createdAt" | "conversationCount" | "messagesToday" | "email";

function Admin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meFn = useServerFn(getMe);
  const overviewFn = useServerFn(adminOverview);
  const usersFn = useServerFn(adminListUsers);
  const suspendFn = useServerFn(adminToggleSuspend);
  const deleteFn = useServerFn(adminDeleteUser);
  const seriesFn = useServerFn(adminSeries);
  const detailFn = useServerFn(adminUserDetail);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; email: string } | null>(null);

  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const enabled = !!me.data?.isAdmin;
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => overviewFn(), enabled });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn(), enabled });
  const series = useQuery({ queryKey: ["admin-series"], queryFn: () => seriesFn(), enabled });
  const detail = useQuery({
    queryKey: ["admin-user", detailId],
    queryFn: () => detailFn({ data: { userId: detailId! } }),
    enabled: !!detailId,
  });

  useEffect(() => {
    if (me.data && !me.data.isAdmin) navigate({ to: "/dashboard" });
  }, [me.data, navigate]);

  const suspend = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      suspendFn({ data: { userId: id, suspended } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { userId: id } }),
    onSuccess: () => {
      toast.success("That person and their rooms are gone.");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (users.data ?? []).filter(
      (u) =>
        !q ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.displayName ?? "").toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "email") return dir * (a.email ?? "").localeCompare(b.email ?? "");
      if (sortKey === "createdAt") return dir * a.createdAt.localeCompare(b.createdAt);
      return dir * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [users.data, query, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  if (!me.data?.isAdmin) return <div className="p-8 text-center text-muted-foreground">Checking…</div>;

  const stats = [
    { label: "Total users", value: overview.data?.totalUsers },
    { label: "Active today", value: overview.data?.activeUsersToday },
    { label: "Total rooms", value: overview.data?.totalConversations },
    { label: "Total messages", value: overview.data?.totalMessages },
  ];

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
        <section>
          <h2 className="serif text-2xl mb-4">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-card warm-border p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="serif text-3xl mt-1">{s.value ?? "…"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-card warm-border p-5">
            <h3 className="serif text-lg mb-4">Messages — last 14 days</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series.data ?? []}>
                  <defs>
                    <linearGradient id="msgFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fill="url(#msgFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl bg-card warm-border p-5">
            <h3 className="serif text-lg mb-4">Active people &amp; new arrivals</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="activeUsers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="signups" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="serif text-2xl">Users</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email or name…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl bg-card warm-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <SortableTh label="Email" onClick={() => toggleSort("email")} active={sortKey === "email"} />
                  <th className="text-left p-3">Name</th>
                  <SortableTh label="Joined" onClick={() => toggleSort("createdAt")} active={sortKey === "createdAt"} />
                  <SortableTh label="Rooms" onClick={() => toggleSort("conversationCount")} active={sortKey === "conversationCount"} align="right" />
                  <SortableTh label="Today" onClick={() => toggleSort("messagesToday")} active={sortKey === "messagesToday"} align="right" />
                  <th className="text-left p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 last:border-0 hover:bg-accent/20 cursor-pointer"
                    onClick={() => setDetailId(u.id)}
                  >
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.displayName}</td>
                    <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">{u.conversationCount}</td>
                    <td className="p-3 text-right">{u.messagesToday}</td>
                    <td className="p-3">
                      {u.suspended ? (
                        <span className="text-destructive">suspended</span>
                      ) : (
                        <span className="text-muted-foreground">active</span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => suspend.mutate({ id: u.id, suspended: !u.suspended })}>
                        {u.suspended ? "Unsuspend" : "Suspend"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setPendingDelete({ id: u.id, email: u.email ?? "" })}
                        aria-label="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.isLoading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">Loading…</td>
                  </tr>
                )}
                {!users.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground italic">No one matches that.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 className="serif text-2xl mb-4">Site settings</h2>
          <AdminSiteSettings />
        </section>

        <section>
          <h2 className="serif text-2xl mb-4">The Commons — moderation</h2>
          <AdminCommonsFeed />
        </section>
      </main>

      <Sheet open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="serif text-xl">{detail.data?.profile?.display_name ?? "Person"}</SheetTitle>
          </SheetHeader>
          {detail.isLoading && <p className="text-muted-foreground mt-6">Loading…</p>}
          {detail.data?.profile && (
            <div className="mt-6 space-y-6 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">{detail.data.profile.email}</p>
                <p className="text-muted-foreground">
                  Joined {new Date(detail.data.profile.created_at).toLocaleString()}
                </p>
                <p className="text-muted-foreground">Roles: {detail.data.roles.join(", ") || "user"}</p>
                <p className={detail.data.profile.suspended ? "text-destructive" : "text-muted-foreground"}>
                  {detail.data.profile.suspended ? "Suspended" : "Active"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-accent/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Rooms</p>
                  <p className="serif text-2xl">{detail.data.rooms.length}</p>
                </div>
                <div className="rounded-lg bg-accent/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Messages (14d)</p>
                  <p className="serif text-2xl">{detail.data.totalMessages}</p>
                </div>
              </div>

              <div>
                <h4 className="serif text-lg mb-2">Rooms</h4>
                <ul className="space-y-1">
                  {detail.data.rooms.map((r: any) => (
                    <li key={r.id} className="flex justify-between gap-3 border-b border-border/40 py-1.5">
                      <span className="truncate">{r.title}</span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(r.updated_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                  {detail.data.rooms.length === 0 && <li className="text-muted-foreground italic">No rooms yet.</li>}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    suspend.mutate({ id: detail.data!.profile!.id, suspended: !detail.data!.profile!.suspended })
                  }
                >
                  {detail.data.profile.suspended ? "Unsuspend" : "Suspend"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    setPendingDelete({ id: detail.data!.profile!.id, email: detail.data!.profile!.email ?? "" })
                  }
                >
                  Delete user
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their account, rooms, messages and files. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableTh({
  label,
  onClick,
  active,
  align = "left",
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  align?: "left" | "right";
}) {
  return (
    <th className={`p-3 text-${align}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${active ? "text-foreground" : ""}`}
      >
        {label} <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  );
}
